/* content.js — invitation copy only (both languages). PUBLIC file, served to the browser.
   Contains NO guest list and NO secrets — guest identity lives in the database and is
   reached only through the /api routes. Edit the wording here. */
(function () {
  "use strict";
  /* Dial codes shared by the invitation gate and the admin guest form.
     Canada/US first (the hosts), Pakistan second (the venue), then alphabetical.
     Flags are regional-indicator pairs — they render as real flags on phones and
     fall back to the two country letters on desktop Windows, which still reads fine. */
  window.WalimaDial = [
    ["\u{1F1E8}\u{1F1E6}", "+1",   "Canada / USA"],
    ["\u{1F1F5}\u{1F1F0}", "+92",  "Pakistan"],
    ["\u{1F1E6}\u{1F1EA}", "+971", "United Arab Emirates"],
    ["\u{1F1E6}\u{1F1FA}", "+61",  "Australia"],
    ["\u{1F1E7}\u{1F1E9}", "+880", "Bangladesh"],
    ["\u{1F1E7}\u{1F1ED}", "+973", "Bahrain"],
    ["\u{1F1E9}\u{1F1EA}", "+49",  "Germany"],
    ["\u{1F1EA}\u{1F1EC}", "+20",  "Egypt"],
    ["\u{1F1EA}\u{1F1F8}", "+34",  "Spain"],
    ["\u{1F1EB}\u{1F1F7}", "+33",  "France"],
    ["\u{1F1EC}\u{1F1E7}", "+44",  "United Kingdom"],
    ["\u{1F1EE}\u{1F1E9}", "+62",  "Indonesia"],
    ["\u{1F1EE}\u{1F1EA}", "+353", "Ireland"],
    ["\u{1F1EE}\u{1F1F3}", "+91",  "India"],
    ["\u{1F1EE}\u{1F1F9}", "+39",  "Italy"],
    ["\u{1F1EF}\u{1F1F5}", "+81",  "Japan"],
    ["\u{1F1F0}\u{1F1F7}", "+82",  "South Korea"],
    ["\u{1F1F0}\u{1F1FC}", "+965", "Kuwait"],
    ["\u{1F1F2}\u{1F1FE}", "+60",  "Malaysia"],
    ["\u{1F1F3}\u{1F1F1}", "+31",  "Netherlands"],
    ["\u{1F1F3}\u{1F1FF}", "+64",  "New Zealand"],
    ["\u{1F1F4}\u{1F1F2}", "+968", "Oman"],
    ["\u{1F1F6}\u{1F1E6}", "+974", "Qatar"],
    ["\u{1F1F8}\u{1F1E6}", "+966", "Saudi Arabia"],
    ["\u{1F1F8}\u{1F1EA}", "+46",  "Sweden"],
    ["\u{1F1F8}\u{1F1EC}", "+65",  "Singapore"],
    ["\u{1F1F9}\u{1F1F7}", "+90",  "Turkey"],
    ["\u{1F1FF}\u{1F1E6}", "+27",  "South Africa"],
    ["\u{1F1E8}\u{1F1F3}", "+86",  "China"]
  ];

  window.WalimaContent = {
    MAX_PARTY_SIZE: 10,
    VENUE_MAP: "https://maps.app.goo.gl/j6fg7t1pyEC6q9V47",
    en: {
      dir: "ltr",
      mapWord: "Map",
      mapLabel: "View Orient Banquet on Google Maps",
      invite: "We cordially invite the pleasure of your company to grace the auspicious occasion of the Valima of",
      groom: "Muhammad Ashhad",
      groomParent: "the beloved son of Mr Ahmed Shemail and Mrs Munazzah Asif",
      withWord: "With",
      bride: "Bismah Kashif",
      brideParent: "the beloved daughter of Mr Kashif Ali and Mrs Aisha Kashif",
      date: "Thursday, 7th January 2027",
      venue: "Orient Banquet",
      venueLoc: "Gulistan-e-Jauhar, Karachi",
      programmeTitle: "Programme",
      programme: [
        { label: "Arrival of Guests", time: "7:00 pm" },
        { label: "Reception",         time: "8:00 pm" },
        { label: "Farewell Ceremony", time: "9:00 pm" }
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
      date: "بروز جمعرات، ۷ جنوری ۲۰۲۷",
      venue: "اورینٹ بینکوئٹ",
      venueLoc: "گلستانِ جوہر، کراچی",
      programmeTitle: "تقریب",
      programme: [
        { label: "مہمانوں کی آمد", time: "٧ بجے شام" },
        { label: "استقبالیہ",     time: "٨ بجے شام" },
        { label: "رخصتی",         time: "٩ بجے شب" }
      ],
      greeting: "محترم",
      rsvpCta: "جواب دیں",
      rsvpHere: "جواب یہاں دیں"
    }
  };
})();
