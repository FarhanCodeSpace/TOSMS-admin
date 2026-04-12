const icons = require("lucide-react");
const names = [
  "Bus",
  "Calendar",
  "ChevronLeft",
  "ChevronRight",
  "CreditCard",
  "LayoutDashboard",
  "Map",
  "MapPin",
  "Settings",
  "Star",
  "Users",
  "GraduationCap",
  "LogOut",
  "Sparkles",
];
for (const name of names) {
  console.log(name, icons[name] ? "defined" : "undefined");
}
