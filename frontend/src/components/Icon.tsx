import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";

export type IconName = React.ComponentProps<typeof MaterialDesignIcons>["name"];
export const Icon = MaterialDesignIcons;

export const CATEGORY_ICON: Record<string, IconName> = {
  weapons: "pistol",
  armor: "tshirt-crew-outline",
  deviations: "ghost-outline",
  weapon_mods: "puzzle-outline",
  armor_mods: "shield-star-outline",
};

export function statIcon(label: string): IconName {
  const l = label.toLowerCase();
  if (l.includes("ammo")) return "ammunition";
  if (l.includes("magazine")) return "format-list-bulleted-square";
  if (l === "dmg" || l.includes("damage")) return "target";
  if (l.includes("crit")) return "flash-outline";
  if (l.includes("weakspot")) return "bullseye-arrow";
  if (l.includes("fire rate")) return "speedometer";
  if (l.includes("accuracy")) return "crosshairs";
  if (l.includes("stability")) return "chart-line";
  if (l.includes("range")) return "ruler";
  if (l.includes("reload")) return "reload";
  if (l.includes("weight")) return "weight";
  if (l.includes("durability")) return "wrench-outline";
  if (l === "hp") return "heart-outline";
  if (l.includes("pollution")) return "biohazard";
  if (l.includes("psi")) return "brain";
  if (l.includes("slot") || l.includes("type")) return "tag-outline";
  if (l.includes("mood")) return "lightbulb-on-outline";
  if (l.includes("utility")) return "hammer-wrench";
  return "circle-small";
}
