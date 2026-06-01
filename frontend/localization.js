const translations = {
    en: {
        "nav_how_it_works": "How it works",
        "nav_features": "Features",
        "nav_docs": "Docs",
        "nav_privacy": "Privacy",
        "nav_signin": "Sign in",
        "nav_connect_github": "Connect GitHub",
        "hero_title": "PR Health Monitoring, without the noise.",
        "hero_subtitle": "Bob gives you instant visibility into what's blocking your team. No CI/CD integration needed—just connect GitHub and go."
    },
    hi: {
        "nav_how_it_works": "यह कैसे काम करता है",
        "nav_features": "विशेषताएं",
        "nav_docs": "दस्तावेज़",
        "nav_privacy": "गोपनीयता",
        "nav_signin": "साइन इन करें",
        "nav_connect_github": "गिटहब कनेक्ट करें",
        "hero_title": "पीआर स्वास्थ्य निगरानी, बिना शोर के।",
        "hero_subtitle": "बॉब आपको तुरंत दृश्यता देता है कि आपकी टीम को क्या रोक रहा है। कोई CI/CD एकीकरण आवश्यक नहीं—बस गिटहब कनेक्ट करें और आगे बढ़ें।"
    },
    or: {
        "nav_how_it_works": "ଏହା କିପରି କାମ କରେ",
        "nav_features": "ବୈଶିଷ୍ଟ୍ୟଗୁଡିକ",
        "nav_docs": "ଡକ୍ୟୁମେଣ୍ଟ୍",
        "nav_privacy": "ଗୋପନୀୟତା",
        "nav_signin": "ସାଇନ୍ ଇନ୍ କରନ୍ତୁ",
        "nav_connect_github": "ଗିଟହବ୍ ସଂଯୋଗ କରନ୍ତୁ",
        "hero_title": "ଶବ୍ଦ ବିନା, ପିଆର ସ୍ୱାସ୍ଥ୍ୟ ମନିଟରିଂ |",
        "hero_subtitle": "ଆପଣଙ୍କ ଦଳକୁ କ’ଣ ଅଟକାଉଛି ବବ୍ ଆପଣଙ୍କୁ ତୁରନ୍ତ ଦୃଶ୍ୟମାନ କରେ | କୌଣସି CI/CD ଏକୀକରଣ ଆବଶ୍ୟକ ନାହିଁ - କେବଳ ଗିଟହବ୍ ସଂଯୋଗ କରନ୍ତୁ ଏବଂ ଯାଆନ୍ତୁ |"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('lang-selector');
    if (!selector) return;

    selector.addEventListener('change', (e) => {
        const lang = e.target.value;
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang] && translations[lang][key]) {
                el.textContent = translations[lang][key];
            }
        });
    });
});
