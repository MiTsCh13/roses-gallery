import { configure } from "@testing-library/react";

// Langsame CI-Runner brauchen für mehrstufige Komponententests (z. B.
// Favoriten: Liste anlegen → senden → Link) mehr als die Standard-1 s, bis
// `findBy…`/`waitFor` greifen. Ein höheres Limit verlängert nur Fehlschläge.
configure({ asyncUtilTimeout: 5000 });
