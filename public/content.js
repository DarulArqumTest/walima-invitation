/* content.js — invitation copy only (both languages). PUBLIC file, served to the browser.
   Contains NO guest list and NO secrets — guest identity lives in the database and is
   reached only through the /api routes. Edit the wording here. */
(function () {
  "use strict";
  window.WalimaContent = {
    MAX_PARTY_SIZE: 6,
    VENUE_MAP: "https://maps.app.goo.gl/j6fg7t1pyEC6q9V47",
    en: {
      dir: "ltr",
      mapWord: "Map",
      mapLabel: "View Orient Banquet on Google Maps",
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
      rsvpHere: "RSVP HERE"
    },
    ur: {
      dir: "rtl",
      mapWord: "نقشہ",
      mapLabel: "اورینٹ بینکوئٹ گوگل میپس پر دیکھیں",
      invite: "بصد مسرّت آپ کو تقریبِ ولیمہ میں شرکت کی پر خلوص دعوت دی جاتی ہے",
      groom: "محمد اشہد",
      groomParent: "فرزند احمد شمائل و منزّہ آصف",
      withWord: "بہمراہ",
      bride: "بسمہ کاشف",
      brideParent: "دختر کاشف علی و عائشہ کاشف",
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
      rsvpHere: "جواب یہاں دیں"
    }
  };
})();
