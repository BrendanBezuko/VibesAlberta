import {
  BUILDING_DEFS,
  HQ_UPGRADE_COSTS,
  getUpgradeCost,
  getEffectiveRate,
  getEffectiveDefense,
  getEffectiveUpkeep,
  formatCost,
} from './resources.js';
import { TROOP_DEFS, getAutoTrainInterval } from './troops.js';

export class UIManager {
  constructor(resourceManager, game) {
    this.rm = resourceManager;
    this.game = game;
    this.selectedBuilding = null;
    this.els = {
      oil: document.getElementById('res-oil'),
      wheat: document.getElementById('res-wheat'),
      lumber: document.getElementById('res-lumber'),
      hqLevel: document.getElementById('hq-level'),
      infoPanel: document.getElementById('info-panel'),
      infoTitle: document.getElementById('info-title'),
      infoDesc: document.getElementById('info-desc'),
      infoLevel: document.getElementById('info-level'),
      infoActions: document.getElementById('info-action-buttons'),
      infoClose: document.getElementById('info-close'),
      cancelBuild: document.getElementById('cancel-build'),
      canvas: document.getElementById('game-canvas'),
      raidBar: document.getElementById('raid-bar-fill'),
      raidText: document.getElementById('raid-timer-text'),
      waveNum: document.getElementById('wave-num'),
      toastContainer: document.getElementById('toast-container'),
      oilCap: document.getElementById('cap-oil'),
      wheatCap: document.getElementById('cap-wheat'),
      lumberCap: document.getElementById('cap-lumber'),
    };

    this.rm.onChange((resources, capacity, hqLevel) => {
      this.els.oil.textContent = Math.floor(resources.oil);
      this.els.wheat.textContent = Math.floor(resources.wheat);
      this.els.lumber.textContent = Math.floor(resources.lumber);
      this.els.hqLevel.textContent = hqLevel;
      if (this.els.oilCap) this.els.oilCap.style.width = `${(resources.oil / capacity.oil) * 100}%`;
      if (this.els.wheatCap) this.els.wheatCap.style.width = `${(resources.wheat / capacity.wheat) * 100}%`;
      if (this.els.lumberCap) this.els.lumberCap.style.width = `${(resources.lumber / capacity.lumber) * 100}%`;
      this.updateBuildButtons();
      if (this.selectedBuilding) this.renderActions(this.selectedBuilding);
    });

    document.querySelectorAll('.build-btn[data-building]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.building;
        this.game.startPlacement(type);
        this.setActiveButton(type);
      });
    });

    this.els.cancelBuild.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.cancelPlacement();
      this.setActiveButton(null);
    });

    this.els.infoClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideInfoPanel();
    });

    this.els.infoPanel?.addEventListener('mousedown', (e) => e.stopPropagation());
    this.els.infoPanel?.addEventListener('click', (e) => e.stopPropagation());

    const raidStatus = document.getElementById('raid-status');
    raidStatus?.addEventListener('click', () => {
      if (!this.game.combat.raidActive) {
        this.game.combat.triggerRaidNow();
      }
    });

    this.updateBuildButtons();
  }

  setActiveButton(type) {
    document.querySelectorAll('.build-btn[data-building]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.building === type);
    });
    this.els.canvas.classList.toggle('placing', !!type);
  }

  updateBuildButtons() {
    const raidActive = this.game.combat?.raidActive ?? false;
    document.querySelectorAll('.build-btn[data-building]').forEach((btn) => {
      const type = btn.dataset.building;
      const def = BUILDING_DEFS[type];
      const raidBlocked = type === 'fence' && raidActive;
      btn.disabled = !this.rm.canAfford(def.cost) || raidBlocked;
      if (type === 'fence') {
        btn.title = raidBlocked
          ? 'Ranch Fence — unavailable during raids (rebuilds after)'
          : 'Ranch Fence — F hotkey, R to rotate (no building during raids)';
      }
    });
  }

  showBuildingInfo(building) {
    this.selectedBuilding = building;
    const def = BUILDING_DEFS[building.type];
    if (!def) return;

    const level = building.level ?? 1;

    this.els.infoTitle.textContent = def.name;
    this.els.infoLevel.textContent = `Level ${level}`;

    let desc = def.description;
    const rate = getEffectiveRate(building);
    if (rate > 0) desc += ` Produces ${rate.toFixed(1)}/sec.`;
    const defense = getEffectiveDefense(building);
    if (defense > 0) desc += ` Defense: ${defense}.`;
    const upkeep = getEffectiveUpkeep(building);
    if (upkeep) {
      desc += ` Upkeep: ${formatCost(upkeep)}/sec.`;
    }
    if (def.defenseOilCost) {
      desc += ` Shots cost ${def.defenseOilCost * level}🛢️ each.`;
    }
    if (def.storageBonus) {
      const bonus = Object.entries(def.storageBonus).map(([k, v]) => `+${v} ${k}`).join(', ');
      desc += ` Capacity: ${bonus}.`;
    }
    if (building.hp != null) {
      desc += ` Durability: ${Math.ceil(building.hp)}/${building.maxHp}.`;
    }
    if (def.autoTrains && TROOP_DEFS[def.autoTrains]) {
      const troop = TROOP_DEFS[def.autoTrains];
      const interval = getAutoTrainInterval(troop, level);
      const left = Math.max(0, interval - (building._autoTrainTimer ?? 0));
      desc += ` Auto-deploys ${troop.name} every ${interval.toFixed(1)}s (${formatCost(troop.cost)}).`;
      if (left > 0.1) desc += ` Next in ${Math.ceil(left)}s.`;
    } else if (def.trains && TROOP_DEFS[def.trains]) {
      const troop = TROOP_DEFS[def.trains];
      desc += ` Press T or click Train (${formatCost(troop.cost)}).`;
    }

    const queue = this.game.combat?.getTrainingFor(building) ?? [];
    if (queue.length > 0) {
      desc += ` Training: ${queue.map((t) => `${t.def.name} ${Math.ceil(t.timeLeft)}s`).join(', ')}.`;
    }

    this.els.infoDesc.textContent = desc;
    this.els.infoPanel.classList.remove('hidden');
    this.renderActions(building);
  }

  renderActions(building) {
    const container = this.els.infoActions;
    if (!container) return;

    container.replaceChildren();

    const def = BUILDING_DEFS[building.type];
    if (!def) return;

    const level = building.level ?? 1;
    const maxLevel = def.maxLevel ?? 3;

    if (level < maxLevel) {
      const cost = building.type === 'hq' ? HQ_UPGRADE_COSTS[level + 1] : getUpgradeCost(building);
      const canUpgrade = cost && this.rm.canAfford(cost);
      const btn = document.createElement('button');
      btn.className = 'action-btn upgrade-btn';
      btn.textContent = `⬆️ Upgrade (${formatCost(cost ?? {})})`;
      btn.disabled = !canUpgrade;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.upgradeBuilding(this.selectedBuilding);
      });
      container.appendChild(btn);
    }

    if (def.trains && TROOP_DEFS[def.trains]) {
      const troop = TROOP_DEFS[def.trains];
      const queueFull = (this.game.combat?.getTrainingFor(building).length ?? 0) >= 2;
      const canTrain = this.rm.canAfford(troop.cost) && !queueFull;

      const btn = document.createElement('button');
      btn.className = 'action-btn train-btn';
      btn.textContent = `${troop.icon} Train ${troop.name} (${formatCost(troop.cost)})`;
      btn.disabled = !canTrain;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.disabled) {
          if (!this.rm.canAfford(troop.cost)) {
            this.showToast(`Need ${formatCost(troop.cost)} to train`, 'warn');
          } else if (queueFull) {
            this.showToast('Training queue full at this building', 'warn');
          }
          return;
        }
        this.game.trainAtSelected();
      });
      container.appendChild(btn);

      if (queueFull) {
        const hint = document.createElement('p');
        hint.className = 'action-hint';
        hint.textContent = 'Training queue full at this building';
        container.appendChild(hint);
      }
    }
  }

  refreshBuildingInfo(building) {
    if (!building || this.els.infoPanel.classList.contains('hidden')) return;
    if (this.selectedBuilding?.id !== building.id) return;

    const def = BUILDING_DEFS[building.type];
    if (!def) return;

    let desc = def.description;
    const rate = getEffectiveRate(building);
    if (rate > 0) desc += ` Produces ${rate.toFixed(1)}/sec.`;
    const defense = getEffectiveDefense(building);
    if (defense > 0) desc += ` Defense: ${defense}.`;
    const upkeep = getEffectiveUpkeep(building);
    if (upkeep) {
      desc += ` Upkeep: ${formatCost(upkeep)}/sec.`;
    }
    if (def.defenseOilCost) {
      desc += ` Shots cost ${def.defenseOilCost * level}🛢️ each.`;
    }
    if (def.storageBonus) {
      const bonus = Object.entries(def.storageBonus).map(([k, v]) => `+${v} ${k}`).join(', ');
      desc += ` Capacity: ${bonus}.`;
    }
    if (building.hp != null) {
      desc += ` Durability: ${Math.ceil(building.hp)}/${building.maxHp}.`;
    }
    if (def.autoTrains && TROOP_DEFS[def.autoTrains]) {
      const troop = TROOP_DEFS[def.autoTrains];
      const level = building.level ?? 1;
      const interval = getAutoTrainInterval(troop, level);
      const left = Math.max(0, interval - (building._autoTrainTimer ?? 0));
      desc += ` Auto-deploys ${troop.name} every ${interval.toFixed(1)}s (${formatCost(troop.cost)}).`;
      if (left > 0.1) desc += ` Next in ${Math.ceil(left)}s.`;
    } else if (def.trains && TROOP_DEFS[def.trains]) {
      const troop = TROOP_DEFS[def.trains];
      desc += ` Press T or click Train (${formatCost(troop.cost)}).`;
    }
    const queue = this.game.combat?.getTrainingFor(building) ?? [];
    if (queue.length > 0) {
      desc += ` Training: ${queue.map((t) => `${t.def.name} ${Math.ceil(t.timeLeft)}s`).join(', ')}.`;
    }
    this.els.infoDesc.textContent = desc;
    this.renderActions(building);
  }

  hideInfoPanel() {
    this.els.infoPanel.classList.add('hidden');
    this.selectedBuilding = null;
  }

  onPlacementEnd() {
    this.setActiveButton(null);
  }

  setRaidTimer(remaining, total) {
    const pct = Math.max(0, (remaining / total) * 100);
    if (this.els.raidBar) this.els.raidBar.style.width = `${pct}%`;
    if (this.els.raidText) {
      this.els.raidText.textContent = this.game.combat.raidActive
        ? '⚔️ UNDER ATTACK'
        : `Next raid: ${Math.ceil(remaining)}s — click to start`;
    }
    if (this.els.waveNum) this.els.waveNum.textContent = this.game.combat.wave;
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.els.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}
