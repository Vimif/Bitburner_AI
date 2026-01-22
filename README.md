# 🤖 Bitburner AI v2.0

Système d'automatisation avancé pour [Bitburner](https://github.com/danielyxber/bitburner). Cette IA optimise automatiquement toutes les mécaniques du jeu.

## 🚀 Installation

1. **Cloner le repository**
   ```bash
   git clone https://github.com/Vimif/Bitburner_AI.git
   cd Bitburner_AI
   npm install
   ```

2. **Lancer le serveur de synchronisation**
   ```bash
   npm start
   ```

3. **Dans Bitburner**
   - Activer l'API Remote (Options → Remote API)
   - Port: 12525
   - Lancer: `run start.js`

## 📦 Architecture

```
scripts/
├── start.js           # Point d'entrée (détection BitNode)
├── main.js            # Orchestrateur principal
├── early.js           # Mode early game (< 32GB RAM)
├── daemons/           # Daemons automatisés
│   ├── daemon-hack.js        # Proto-batching HWGW
│   ├── daemon-optimizer.js   # A/B testing & auto-tune
│   ├── daemon-stocks.js      # Trading avec risk management
│   ├── daemon-servers.js     # Gestion serveurs perso
│   ├── daemon-hacknet.js     # Hacknet nodes/servers
│   ├── daemon-gang.js        # Gang automation
│   ├── daemon-sleeve.js      # Sleeve management
│   ├── daemon-corp.js        # Corporation AI
│   ├── daemon-bladeburner.js # Bladeburner ops
│   ├── daemon-factions.js    # Factions & augmentations
│   ├── daemon-buyer.js       # Programmes & upgrades
│   ├── daemon-contracts.js   # Coding contracts
│   ├── daemon-stanek.js      # Stanek's Gift
│   ├── daemon-share.js       # Share power
│   └── daemon-prestige.js    # Prestige automation
├── lib/               # Utilitaires
│   ├── utils.js              # Fonctions communes (caching)
│   ├── constants.js          # Configuration
│   └── brain-state.js        # État centralisé
└── workers/           # Scripts de hack
    ├── hack.js
    ├── grow.js
    └── weaken.js
```

## 🧠 Fonctionnalités v2.0

### Core Hacking
- **Proto-batching HWGW** - Batches en pipeline pour +50% efficacité
- **Multi-target pool** - Prépare plusieurs serveurs en parallèle
- **Advanced scoring** - Pénalise les serveurs non préparés

### Intelligence Layer
- **A/B Testing** - 4 variants (conservative, balanced, aggressive, extreme)
- **Trend Analysis** - Analyse sur 1min/5min/15min
- **Cross-daemon Feedback** - Les daemons partagent leurs métriques
- **Persistent Learning** - Sauvegarde les meilleures configurations

### Financial Systems
- **Stop-loss/Take-profit** - Gestion automatique des risques
- **Position Sizing** - Basé sur la volatilité
- **Diversification** - Maximum 6 positions simultanées

### BitNode Support
Configuration automatique pour BN1-14:

| BitNode | Focus | Daemons Prioritaires |
|---------|-------|---------------------|
| BN1 | Hacking | hack, servers, hacknet |
| BN2 | Gang | gang, hack, sleeve |
| BN3 | Corporation | corp, hack, stocks |
| BN6/7 | Bladeburner | bladeburner, sleeve |
| BN8 | Stocks | stocks (pas de hack) |
| BN9 | Hacknet | hacknet, hack |
| BN10 | Sleeves | sleeve, hack |

### Synergy Systems
- **Brain-state** - État centralisé pour coordination
- **Priority-aware** - Tâches adaptées à la phase de jeu
- **Feedback loop** - Optimisation continue

## 📊 Daemons

| Daemon | Description | Auto-activé |
|--------|-------------|-------------|
| `daemon-hack` | Proto-batching HWGW | ✅ |
| `daemon-optimizer` | A/B testing, tuning | ✅ |
| `daemon-servers` | Achat/upgrade serveurs | ✅ |
| `daemon-hacknet` | Hacknet management | ✅ |
| `daemon-stocks` | Trading algorithmique | Si API dispo |
| `daemon-gang` | Gang automation | Si SF2 |
| `daemon-sleeve` | Sleeve management | Si SF10 |
| `daemon-corp` | Corporation AI | Si SF3 |
| `daemon-bladeburner` | Bladeburner ops | Si SF6/7 |
| `daemon-factions` | Augmentations | Si SF4 |
| `daemon-buyer` | Programmes | Si SF4 |
| `daemon-contracts` | Coding contracts | ✅ |

## ⚙️ Configuration

Modifiez `lib/constants.js` pour personnaliser:

```javascript
export const HACK_CONFIG = {
    HACK_PERCENT: 0.5,        // % d'argent à voler
    SECURITY_THRESHOLD: 5,    // Buffer sécurité
    MONEY_THRESHOLD: 0.8,     // % argent min avant hack
    BATCH_DELAY: 100,         // ms entre batches
};
```

## 🔧 API Files

Le système crée des fichiers de données dans `/data/`:

- `brain-state.txt` - État global du système
- `optimizer-config.txt` - Configuration dynamique
- `optimizer-data.txt` - Historique des performances
- `bitnode-config.txt` - Configuration BitNode
- `feedback-*.txt` - Feedback des daemons

## 📈 Performance

- **+50% efficacité hacking** avec proto-batching
- **Adaptation automatique** aux différents BitNodes
- **Risque réduit** sur le trading (stop-loss)
- **RAM optimisée** avec caching et workers légers

## 🐛 Troubleshooting

**Les daemons ne se lancent pas?**
- Vérifiez la RAM disponible sur home
- Certains daemons nécessitent des Source-Files

**Pas de revenus?**
- Vérifiez que `daemon-hack` est en cours
- Regardez le tail pour les erreurs

**Synchronisation ne fonctionne pas?**
- Vérifiez que `npm start` tourne
- Activez Remote API dans Bitburner

## 📜 License

MIT License - Vimif 2024