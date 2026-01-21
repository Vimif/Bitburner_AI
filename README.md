# 🤖 Bitburner AI

Un système d'intelligence artificielle complet et autonome pour dominer [Bitburner](https://store.steampowered.com/app/1812820/Bitburner/).
Développé en 11 Phases d'optimisation, du simple hacking jusqu'au **God Mode**.

## 🚀 Installation

### Prérequis
- [Node.js](https://nodejs.org/) (pour le WebSocket serveur)
- [Bitburner](https://store.steampowered.com/app/1812820/Bitburner/) (Steam ou Web)

### Configuration Rapide

1. **Cloner et Installer**
   ```bash
   git clone https://github.com/Vimif/Bitburner_AI.git
   cd Bitburner_AI
   npm install
   ```

2. **Lancer le serveur**
   ```bash
   npm start
   ```

3. **Connecter le jeu**
   - Dans Bitburner : `Options` → `Remote API`
   - Socket: `127.0.0.1:1324`
   - Cliquez sur `Connect`

## 🎮 Utilisation

Une seule commande suffit pour tout gérer, du début à la fin :

```bash
run start.js
```

Le système est **intelligent** et détecte votre contexte :
*   **Mode Early (< 32GB RAM)** : Lance `early.js`, une version légère pour bootstraper l'XP et l'argent.
*   **Mode Advanced (≥ 32GB RAM)** : Lance `main.js`, l'orchestrateur complet avec tous les daemons.
*   **BitNode Detection** : Il analyse le BitNode courant (ex: BN8 Trading, BN12 Cylinder) et adapte sa stratégie globale.

## ✨ Fonctionnalités (God Mode)

Le système est complet à 110% et automate **toutes** les méchaniques du jeu.

### 🧠 Cœur du Système
*   **Adaptive Learning** (`daemon-optimizer.js`) : Apprend de ses erreurs, analyse la rentabilité des cibles et ajuste ses stratégies (agressif/défensif) en temps réel. Persistant entre resets.
*   **Smart Orchestration** : Batching HWGW parfait (timing synchronisé à la milliseconde via Formulas API).
*   **Context Aware** : Sait quand hack, quand trade, quand reset.

### 🏢 Gestion Macro (Empire)
*   **Corporation** : Création automatique, R&D, lancement de produits (Tobacco/Software), gestion budget R&D/Marketing, Market-TA.
*   **Gang** : Recrutement, ascension automatique (optimisation multiplicateurs), guerre de territoire, achat d'équipement.
*   **Stocks** : Trading algorithmique haute fréquence (Long & Short avec effet de levier sur BN8).
*   **Bladeburner** : Gestion automatique des opérations, City Chaos reduction, BlackOps pour finir le jeu.

### 👤 Gestion Micro (Personnage)
*   **Factions & Augmentations** : Rejoint les factions, travaille pour la réputation, achète les augmentations et NeuroFlux.
*   **Sleeves** : Gestion des tâches (Shock recovery, Gym, Crime, Faction work, Bladeburner Diplo).
*   **Hacknet** : Gestion optimale des Hashes (Vente pour Corp Funds, Bladeburner Rank, ou Cash).
*   **Stanek** : Chargement automatique des fragments.
*   **Coding Contracts** : Résolution instantanée de tous les types de puzzles.

### ⚡ Optimisations Ultimes (Phase 10-11)
*   **Smart Share** : Utilise la RAM inutilisée pour booster la réputation (`ns.share()`) quand nécessaire.
*   **Prestige Analyzer** : Analyse vos augmentations en file d'attente et vous dit exactement quand faire un Soft Reset.
*   **BitNode Specialization** : Stratégies uniques par BitNode (ex: Full Trading en BN8).

## 📁 Structure du Projet

```
scripts/
├── start.js             # Lancement intelligent & Détection BitNode
├── main.js              # Orchestrateur (Advanced Game)
├── early.js             # Orchestrateur (Early Game)
│
├── daemons/             # Agents spécialisés
│   ├── daemon-hack.js         # Hacking HWGW & Formulas
│   ├── daemon-optimizer.js    # Machine Learning & Config
│   ├── daemon-corp.js         # CEO Corporation
│   ├── daemon-gang.js         # Chef de Gang
│   ├── daemon-stocks.js       # Trader Wall Street
│   ├── daemon-bladeburner.js  # Agent Secret
│   ├── daemon-share.js        # Booster de Réputation
│   ├── daemon-prestige.js     # Conseiller Reset
│   └── ... (autres daemons)
│
└── lib/                 # Librairies partagées
```

## 🤝 Contribution
Contributions bienvenues !

## 📜 License
MIT