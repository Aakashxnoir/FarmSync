<div align="center">
  <h3><code>aakash@github ~/FarmSync $ ./banner.sh</code></h3>
  <img src="./assets/wordmark.svg" width="640" alt="FarmSync — 3D ASCII Wordmark" />
  <p><code>High yield crop prediction using quantum AI</code></p>

  <br><br>

  <h3><code>aakash@github ~/FarmSync $ cat about.txt</code></h3>
  <p>A digital guidebook for new farmers in Tamil Nadu. Enter your land and soil readings and it returns the crops that will grow there, the order to plant them across the year, and what the soil needs first. The order comes from a QAOA circuit, not a sort: a crop's value depends on what was planted before it, so the best order is rarely the ranked one. <a href="PRD.md">PRD</a> and <a href="TRD.md">TRD</a> have the numbers.</p>

  <br><br>

  <h3><code>aakash@github ~/FarmSync $ ./stack.sh</code></h3>
  <p>
    <img src="https://img.shields.io/badge/Flutter-0d1117?style=for-the-badge&logo=flutter&logoColor=white" alt="Flutter" />&nbsp;
    <img src="https://img.shields.io/badge/Dart-0d1117?style=for-the-badge&logo=dart&logoColor=white" alt="Dart" />&nbsp;
    <img src="https://img.shields.io/badge/Python-0d1117?style=for-the-badge&logo=python&logoColor=white" alt="Python" />&nbsp;
    <img src="https://img.shields.io/badge/FastAPI-0d1117?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />&nbsp;
    <img src="https://img.shields.io/badge/PennyLane-0d1117?style=for-the-badge" alt="PennyLane" />&nbsp;
    <img src="https://img.shields.io/badge/LightGBM-0d1117?style=for-the-badge" alt="LightGBM" />&nbsp;
    <img src="https://img.shields.io/badge/Clerk-0d1117?style=for-the-badge&logo=clerk&logoColor=white" alt="Clerk" />&nbsp;
    <img src="https://img.shields.io/badge/Supabase-0d1117?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />&nbsp;
    <img src="https://img.shields.io/badge/Railway-0d1117?style=for-the-badge&logo=railway&logoColor=white" alt="Railway" />
  </p>

  <br><br>

  <h3><code>aakash@github ~/FarmSync $ ./run.sh</code></h3>
</div>

```bash
git clone https://github.com/Aakashxnoir/FarmSync.git
cd FarmSync/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m scripts.build_training_set && python -m scripts.train_model
python -m scripts.seed_demo            # optional: 3 demo farms, set DEV_LOGIN_USER / DEV_LOGIN_TOKEN in .env
uvicorn app.main:app --reload

cd ../flutter_app
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000             # Android emulator
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000  # web
```

<div align="center">
  <br>
  <h3><code>aakash@github ~/FarmSync $ ./links.sh</code></h3>
  <p>
    <a href="https://aakash-portfolio-navy.vercel.app"><img src="https://img.shields.io/badge/Portfolio-NOIR%2FOS-0d1117?style=for-the-badge&logo=vercel&logoColor=white" alt="Portfolio" /></a>&nbsp;
    <a href="https://github.com/Aakashxnoir"><img src="https://img.shields.io/badge/GitHub-Aakashxnoir-0d1117?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" /></a>
  </p>
  <br>
</div>
