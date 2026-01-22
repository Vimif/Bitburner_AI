# 🤖 Bitburner AI v3.0

Système d'automatisation **intelligent et autonome** pour Bitburner.

## 🚀 Quick Start

```bash
# Terminal
npm start

# Dans Bitburner
run start.js
```

## 💾 RAM Requirements

| Script | RAM |
|--------|-----|
| `start.js` | ~3GB |
| `main.js` | ~15GB |
| `early.js` | ~7GB |

### Daemons

| Daemon | RAM | Description |
|--------|-----|-------------|
| `daemon-hack` | ~8GB | Proto-batching HWGW |
| `daemon-optimizer` | ~5GB | A/B testing |
| `daemon-servers` | ~4GB | Achats/upgrades |
| `daemon-hacknet` | ~4GB | Hacknet nodes |
| `daemon-contracts` | ~5GB | Coding contracts |
| `daemon-stocks` | ~6GB | Trading |
| `daemon-gang` | ~5GB | Gang automation |
| `daemon-sleeve` | ~5GB | Sleeve management |
| `daemon-bladeburner` | ~5GB | Bladeburner ops |
| `daemon-corp` | ~8GB | Corporation |
| `daemon-factions` | ~8GB | Augmentations |
| `daemon-buyer` | ~6GB | Programmes |

## 🧠 Fonctionnement

L'IA est **autonome**:
1. `start.js` détecte le BitNode et lance le script approprié
2. `main.js` orchestre les daemons selon la RAM disponible
3. `daemon-optimizer` envoie des directives aux autres daemons
4. Les daemons lisent les directives et s'adaptent

## 📊 Phases de Jeu

| Phase | RAM | Priorités |
|-------|-----|-----------|
| Early | <32GB | XP, crack programs |
| Mid | 32-128GB | Money, servers |
| Late | >128GB | Rep, augmentations |
| Endgame | Max | Prestige |

## 📁 Structure

```
scripts/
├── start.js          # Bootstrap (~3GB)
├── main.js           # Orchestrateur (~15GB)
├── early.js          # Early game (~7GB)
├── h.js, g.js, w.js  # Mini workers (~1.7GB)
├── daemons/          # Daemons automatisés
├── workers/          # Workers HWGW
└── lib/              # Utilitaires
```

## ⚙️ Configuration BitNode

`start.js` configure automatiquement selon le BitNode:

| BN | Focus | Skip |
|----|-------|------|
| 2 | Gang | - |
| 3 | Corp | - |
| 6-7 | Bladeburner | - |
| 8 | Stocks | hack |
| 9 | Hacknet | - |

## 📜 License

MIT