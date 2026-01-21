# 🤖 Bitburner AI

Un système d'intelligence artificielle complet pour automatiser le jeu [Bitburner](https://store.steampowered.com/app/1812820/Bitburner/).

## 🚀 Installation

### Prérequis
- [Node.js](https://nodejs.org/) (pour le serveur de synchronisation)
- [Bitburner](https://store.steampowered.com/app/1812820/Bitburner/) (Steam ou Web)

### Configuration

1. **Cloner le repository**
   ```bash
   git clone https://github.com/Vimif/Bitburner_AI.git
   cd Bitburner_AI
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Lancer le serveur de synchronisation**
   ```bash
   npm start
   ```

4. **Dans Bitburner**
   - Allez dans `Options` → `Remote API`
   - Hostname: `127.0.0.1`
   - Port: `1324`
   - Cliquez sur `Connect`

5. **Les scripts sont automatiquement synchronisés !**

## 🎮 Utilisation

Pour tout niveaux de progression, lancez simplement :

```
run start.js
```

Le script détectera automatiquement votre RAM et lancera :
- **early.js** (< 32GB RAM): Optimisé pour le début de partie.
- **main.js** (≥ 32GB RAM): Orchestrateur complet avec tous les daemons.

## 📁 Structure

```
scripts/
├── start.js             # Point d'entrée universel
├── main.js              # Orchestrateur (Advanced Game)
├── early.js             # Orchestrateur (Early Game)
│
├── daemons/
│   ├── daemon-hack.js         # Système HWGW automatisé
│   ├── daemon-servers.js      # Achat/upgrade serveurs
│   ├── daemon-hacknet.js      # Gestion Hacknet Nodes
│   ├── daemon-contracts.js    # Résolution Contracts
│   ├── daemon-stocks.js       # Trading algorithmique
│   ├── daemon-buyer.js        # Auto-achats (TOR, Progs)
│   ├── daemon-gang.js         # Gestion Gang
│   ├── daemon-corp.js         # Gestion Corporation
│   ├── daemon-bladeburner.js  # Opérations Bladeburner
│   ├── daemon-factions.js     # Gestion Factions/Augs
│   └── daemon-sleeve.js       # Gestion Sleeves
│
├── workers/             # Scripts légers (hack/grow/weaken)
└── lib/                 # Utilitaires & Constantes
```

## ⚙️ Fonctionnalités

### 🎯 Hacking & Optimisation
- **HWGW Batching**: Algorithme de hacking state-of-the-art.
- **Auto-Optimization**: Apprend et ajuste les paramètres en temps réel.
- **Smart Target**: Sélectionne les cibles les plus rentables.

### 🏢 Endgame Automation
Le système gère automatiquement les mécaniques avancées :
- **Corporation**: Création, expansion, employés, produits.
- **Gang**: Recrutement, guerre de territoire (quand win > 60%), équipement.
- **Bladeburner**: Gestion dynamique stamina/opérations/skills.
- **Stocks**: Trading haute fréquence.
- **Sleeves**: Récupération shock/sync et tâches.
- **Factions**: Rejoint et travaille pour la réputation, achète les augmentations.

### 🛠️ Configuration
Modifiez `scripts/lib/constants.js` pour personnaliser les seuils et paramètres globaux.

## 🤝 Contribution
Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une PR.

## 📜 License
MIT