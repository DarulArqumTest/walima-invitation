/* content.js — invitation copy only (both languages). PUBLIC file, served to the browser.
   Contains NO guest list and NO secrets — guest identity lives in the database and is
   reached only through the /api routes. Edit the wording here. */
(function () {
  "use strict";
  window.WalimaContent = {
    MAX_PARTY_SIZE: 6,
    en: {
      dir: "ltr",
      invite: "We cordially invite the pleasure of your company to grace the auspicious occasion of the Walima of",
      groom: "Muhammad Ashhad",
      groomParent: "the beloved son of Mr Ahmed Shemail and Mrs Munazzah Asif",
      withWord: "With",
      bride: "Bismah Kashif",
      brideParent: "the beloved daughter of Mr Kashif Ali and Mrs Aisha Kashif",
      date: "Saturday, 7th January 2027",
      venue: "Orient Banquet",
      venueLoc: "Gulistan-e-Jauhar, Karachi",
      programmeTitle: "Programme",
      programme: [
        { label: "Arrival of guests", time: "7:00 pm" },
        { label: "Reception",         time: "8:00 pm" },
        { label: "Farewell ceremony", time: "9:00 pm" }
      ],
      greeting: "Dear",
      rsvpCta: "RSVP",
      rsvpBelow: "RSVP BELOW"
    },
    ur: {
      dir: "rtl",
      invite: "بصد خوشی آپ کو تقریبِ ولیمہ میں شرکت کی پُرخلوص دعوت دیتے ہیں",
      groom: "محمد اشہد",
      groomParent: "فرزندِ جنابِ احمد شمائل و محترمہ منزّہ آصف",
      withWord: "بہمراہ",
      bride: "بسمہ کاشف",
      brideParent: "دخترِ جنابِ کاشف علی و محترمہ عائشہ کاشف",
      date: "بروز ہفتہ، ۷ جنوری ۲۰۲۷",
      venue: "اورینٹ بینکوئٹ",
      venueLoc: "گلستانِ جوہر، کراچی",
      programmeTitle: "تقریب",
      programme: [
        { label: "مہمانوں کی آمد", time: "۷:۰۰ شام" },
        { label: "استقبالیہ",     time: "۸:۰۰ شام" },
        { label: "رخصتی",         time: "۹:۰۰ شام" }
      ],
      greeting: "محترم",
      rsvpCta: "جواب دیں",
      rsvpBelow: "جواب کے لیے نیچے دیکھیں"
    }
  };
})();
