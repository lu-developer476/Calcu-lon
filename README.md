# Calcu-len (Python + HTML + Vercel)

Calculadora web con 5 modos:
- Estándar
- Científica
- Graficar (Chart.js)
- Programador (bases + bitwise)
- Cálculo de fecha (diff / sumar / restar)

## Stack
- Frontend: HTML/CSS/JS (sin frameworks)
- Backend: Python (FastAPI) como Serverless Function en Vercel

## Seguridad
No se usa `eval()`. Las expresiones se evalúan con un parser seguro (AST) que permite:
- Operadores: `+ - * / // % **`
- Paréntesis
- Constantes: `pi`, `e`, `tau`
- Funciones: `sqrt, sin, cos, tan, asin, acos, atan, log, ln, abs, floor, ceil, round, factorial`

## Ejecutar localmente

### 1) Crear entorno e instalar dependencias
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2) Levantar API
```bash
uvicorn api.index:app --reload
```

### 3) Abrir el frontend
Abrí `public/index.html` con Live Server (VS Code) o servilo con un server estático.

> Nota: en Vercel, el frontend llama a `/api/...` directamente.

## Deploy en Vercel
1. Subir el repositorio a GitHub
2. Importar desde Vercel
3. Deploy

## Endpoints
- `POST /api/calculate`
- `POST /api/graph`
- `GET /api/health`

---
