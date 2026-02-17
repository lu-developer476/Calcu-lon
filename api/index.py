import re
import cmath

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field
from datetime import date, datetime, timedelta
import ast
import math
from typing import Any, Dict, List, Optional, Tuple, Union

app = FastAPI(title="Calculadora Pro API", version="1.0.0")

# ---------------------------
# Safe expression evaluation
# ---------------------------

_ALLOWED_BINOPS = {
    ast.Add: lambda a, b: a + b,
    ast.Sub: lambda a, b: a - b,
    ast.Mult: lambda a, b: a * b,
    ast.Div: lambda a, b: a / b,
    ast.FloorDiv: lambda a, b: a // b,
    ast.Mod: lambda a, b: a % b,
    ast.Pow: lambda a, b: a ** b,
}

_ALLOWED_UNARYOPS = {
    ast.UAdd: lambda a: +a,
    ast.USub: lambda a: -a,
}

ANGLE_MODE = "RAD"  # "RAD" o "DEG"

_ALLOWED_FUNCS = {
    # scientific
    "sqrt": cmath.sqrt,
    "sin": lambda x: cmath.sin(math.radians(x)) if ANGLE_MODE == "DEG" else cmath.sin(x),
    "cos": lambda x: cmath.cos(math.radians(x)) if ANGLE_MODE == "DEG" else cmath.cos(x),
    "tan": lambda x: cmath.tan(math.radians(x)) if ANGLE_MODE == "DEG" else cmath.tan(x),
    "asin": lambda x: math.degrees(cmath.asin(x)) if ANGLE_MODE == "DEG" else cmath.asin(x),
    "acos": lambda x: math.degrees(cmath.acos(x)) if ANGLE_MODE == "DEG" else cmath.acos(x),
    "atan": lambda x: math.degrees(cmath.atan(x)) if ANGLE_MODE == "DEG" else cmath.atan(x),
    "log": cmath.log10,
    "ln": cmath.log,
    "exp": cmath.exp,
    "abs": abs,
    "floor": lambda x: math.floor(x.real) if isinstance(x, complex) else math.floor(x),
    "ceil": lambda x: math.ceil(x.real) if isinstance(x, complex) else math.ceil(x),
    "round": round,
    "fact": math.factorial,
    "factorial": math.factorial,

    # hyperbolic
    "sinh": math.sinh,
    "cosh": math.cosh,
    "tanh": math.tanh,
    "asinh": math.asinh,
    "acosh": math.acosh,
    "atanh": math.atanh,

}

_ALLOWED_CONSTS = {
    "pi": math.pi,
    "e": math.e,
    "tau": math.tau,
    "j": 1j,        # 👈 unidad imaginaria
}

class SafeEvalError(ValueError):
    pass

def _to_number(x: Any) -> Union[float, complex]:
    if isinstance(x, (int, float, complex)):
        return x
    raise SafeEvalError("Número inválido")

def numerical_integral(expr: str, a: float, b: float, n: int = 1000) -> Union[float, complex]:
    step = (b - a) / n
    total = 0

    for i in range(n + 1):
        x = a + i * step
        weight = 1
        if i == 0 or i == n:
            weight = 0.5
        total += weight * safe_eval(expr, {"x": x})

    return total * step

def numerical_derivative(expr: str, x: float, h: float = 1e-5) -> Union[float, complex]:
    return (
        safe_eval(expr, {"x": x + h}) -
        safe_eval(expr, {"x": x - h})
    ) / (2 * h)

def format_result(value: Union[float, complex]) -> str:

    if isinstance(value, complex):

        real = round(value.real, 5)
        imag = round(value.imag, 5)

        # Si parte imaginaria es prácticamente 0 → número real
        if abs(imag) < 1e-12:
            return f"{real:.5f}"

        # Si parte real es prácticamente 0 → solo imaginario
        if abs(real) < 1e-12:
            return f"{imag:.5f}i"

        sign = "+" if imag >= 0 else "-"
        return f"{real:.5f} {sign} {abs(imag):.5f}i"

    value = round(value, 5)

    if abs(value) >= 1e6:
        return f"{value:.5e}"

    return f"{value:.5f}"

def safe_eval(expr: str, variables: Optional[Dict[str, Union[float, complex]]] = None) -> Union[float, complex]:

    if variables is None:
        variables = {}

    # Permitir uso de "i" como imaginario
    expr = re.sub(r'(?<![a-zA-Z])i(?![a-zA-Z])', 'j', expr)

    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as e:
        raise SafeEvalError("Expresión inválida") from e

    def _eval(node: ast.AST) -> Union[float, complex]:

        if isinstance(node, ast.Expression):
            return _eval(node.body)

        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float, complex)):
                return node.value
            raise SafeEvalError("Solo números permitidos")

        if isinstance(node, ast.Name):
            if node.id in variables:
                return variables[node.id]
            if node.id in _ALLOWED_CONSTS:
                return _ALLOWED_CONSTS[node.id]
            raise SafeEvalError(f"Variable inválida: {node.id}")

        if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARYOPS:
            return _ALLOWED_UNARYOPS[type(node.op)](_eval(node.operand))

        if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINOPS:
            return _ALLOWED_BINOPS[type(node.op)](
                _eval(node.left),
                _eval(node.right)
            )

        if isinstance(node, ast.Call):

            # Derivada
            if isinstance(node.func, ast.Name) and node.func.id == "der":
                if len(node.args) != 2:
                    raise SafeEvalError("der requiere 2 argumentos: der(expr, x)")
                expr_source = ast.unparse(node.args[0])
                x_value = _eval(node.args[1])
                return numerical_derivative(expr_source, x_value)

            # Integral
            if isinstance(node.func, ast.Name) and node.func.id == "int":
                if len(node.args) != 3:
                    raise SafeEvalError("int requiere 3 argumentos: int(expr, a, b)")
                expr_source = ast.unparse(node.args[0])
                a = _eval(node.args[1])
                b = _eval(node.args[2])
                return numerical_integral(expr_source, a, b)

            # Funciones matemáticas
            if isinstance(node.func, ast.Name) and node.func.id in _ALLOWED_FUNCS:
                fn = _ALLOWED_FUNCS[node.func.id]
                args = [_eval(a) for a in node.args]
                try:
                    return fn(*args)
                except Exception:
                    raise SafeEvalError("Error en función matemática")

            raise SafeEvalError("Función no permitida")

        raise SafeEvalError("Operación no permitida")

    return _eval(tree)

# ---------------------------
# Models
# ---------------------------

class CalcRequest(BaseModel):
    mode: str = Field(..., description="standard | scientific | programmer | date")
    expression: Optional[str] = None  # for standard/scientific freeform
    # programmer
    number: Optional[int] = None
    base: Optional[int] = None  # 2, 8, 10, 16
    op: Optional[str] = None    # to_base | from_base | bit_and | bit_or | bit_xor | bit_not | shl | shr
    other: Optional[int] = None
    # date
    date1: Optional[str] = None   # YYYY-MM-DD
    date2: Optional[str] = None   # YYYY-MM-DD
    days: Optional[int] = None    # for add/sub
    date_op: Optional[str] = None # diff | add | sub

class GraphRequest(BaseModel):
    expressions: List[str] = Field(..., description="Lista de funciones en x, ej: sin(x) + x**2")
    x_min: float = -10
    x_max: float = 10
    samples: int = 200

# ---------------------------
# Routes
# ---------------------------

@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/angle-mode")
def set_angle_mode(mode: str):
    global ANGLE_MODE
    mode = mode.upper()
    if mode not in ("RAD", "DEG"):
        return {"error": "Modo inválido"}
    ANGLE_MODE = mode
    return {"mode": ANGLE_MODE}

@app.post("/api/calculate")
def calculate(req: CalcRequest):
    mode = (req.mode or "").strip().lower()

    if mode == "standard":
        if not req.expression:
            return {"error": "Falta la expresión"}
        try:
            result = safe_eval(req.expression)
            return {"result": format_result(result)}
        except SafeEvalError as e:
            return {"error": str(e)}

    if mode == "scientific":
        if not req.expression:
            return {"error": "Falta la expresión (ej: sqrt(9), sin(pi/2), log(100))"}
        try:
            result = safe_eval(req.expression)
            return {"result": format_result(result)}
        except SafeEvalError as e:
            return {"error": str(e)}

    if mode == "programmer":
        # Minimal programmer toolkit: base conversions + bitwise ops
        if req.op in ("to_base", "from_base"):
            if req.number is None or req.base is None:
                return {"error": "Faltan number/base"}
            if req.base not in (2, 8, 10, 16):
                return {"error": "Base inválida (2/8/10/16)"}
            n = int(req.number)
            if req.op == "to_base":
                if req.base == 2:
                    return {"result": bin(n)}
                if req.base == 8:
                    return {"result": oct(n)}
                if req.base == 10:
                    return {"result": str(n)}
                if req.base == 16:
                    return {"result": hex(n)}
            else:
                # from_base expects number provided as int is not enough; front sends string in expression
                if not req.expression:
                    return {"error": "Para from_base, mandá el valor en 'expression' (string)"}  # e.g. "FF"
                try:
                    return {"result": int(req.expression.strip(), req.base)}
                except Exception:
                    return {"error": "No se pudo parsear el número en esa base"}

        # bitwise ops: require number and (other for binary ops)
        if req.number is None:
            return {"error": "Falta number"}
        n = int(req.number)
        op = (req.op or "").strip().lower()

        if op in ("bit_and", "bit_or", "bit_xor", "shl", "shr"):
            if req.other is None:
                return {"error": "Falta other"}
            o = int(req.other)
            if op == "bit_and":
                return {"result": n & o}
            if op == "bit_or":
                return {"result": n | o}
            if op == "bit_xor":
                return {"result": n ^ o}
            if op == "shl":
                return {"result": n << o}
            if op == "shr":
                return {"result": n >> o}

        if op == "bit_not":
            return {"result": ~n}

        return {"error": "Operación inválida"}

    if mode == "date":
        op = (req.date_op or "").strip().lower()
        try:
            d1 = datetime.strptime(req.date1, "%Y-%m-%d").date() if req.date1 else None
            d2 = datetime.strptime(req.date2, "%Y-%m-%d").date() if req.date2 else None
        except Exception:
            return {"error": "Formato inválido (usá YYYY-MM-DD)"}

        if op == "diff":
            if not d1 or not d2:
                return {"error": "Faltan date1/date2"}
            return {"result": (d2 - d1).days}

        if op in ("add", "sub"):
            if not d1 or req.days is None:
                return {"error": "Faltan date1/days"}
            delta = timedelta(days=int(req.days))
            out = d1 + delta if op == "add" else d1 - delta
            return {"result": out.isoformat()}

        return {"error": "Operación inválida (diff/add/sub)"}

    return {"error": "Modo inválido"}


@app.post("/api/graph")
def graph(req: GraphRequest):

    if req.samples < 10 or req.samples > 2000:
        return {"error": "samples debe estar entre 10 y 2000"}

    if req.x_max <= req.x_min:
        return {"error": "x_max debe ser mayor que x_min"}

    step = (req.x_max - req.x_min) / (req.samples - 1)

    xs = [req.x_min + step * i for i in range(req.samples)]

    datasets = []

    for expr in req.expressions:

        ys: List[Optional[float]] = []

        for x in xs:
            try:
                y = safe_eval(expr, variables={"x": x})
                if isinstance(y, complex):
                    y = y.real
                    
                ys.append(y)
            except Exception:
                ys.append(None)

        datasets.append({
            "expression": expr,
            "x": xs,
            "y": ys
        })

    return {"datasets": datasets}

# Vercel handler
handler = app
