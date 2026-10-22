/* Firebase projekto nustatymai prisijungimui (žr. README → „Lankytojų prisijungimas“).
   Firebase konsolė → Project settings → General → Your apps → Web app → SDK setup and configuration → Config.
   Šie raktai nėra slapti – juos mato kiekvienas naršyklėje; duomenis saugo firestore.rules taisyklės.
   Kol apiKey tuščias, prisijungimo mygtukas nerodomas. */
window.KINAI_FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};
