// shop.js — shop economy: buy power-ups with starfish (cap 3 each).
import { POWERUPS, INV_CAP } from './config.js';

export function canBuy(saveData, kind) {
  const p = POWERUPS[kind];
  if (!p) return false;
  if (saveData.inventory[kind] >= INV_CAP) return false;
  return saveData.starfish >= p.price;
}

export function buy(saveData, kind) {
  if (!canBuy(saveData, kind)) return false;
  saveData.starfish -= POWERUPS[kind].price;
  const amount = kind === 'shark' ? 2 : 1; // sharks come in pairs
  saveData.inventory[kind] = Math.min(INV_CAP, (saveData.inventory[kind] || 0) + amount);
  return true;
}

export function itemList() {
  return ['ice', 'shark', 'rainbow', 'squid'].map((k) => POWERUPS[k]);
}
