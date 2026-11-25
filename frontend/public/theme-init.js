(function () {
  try {
    if (window.trustedTypes && window.trustedTypes.createPolicy && !window.trustedTypes.defaultPolicy) {
      window.trustedTypes.createPolicy('default', {
        createHTML: function (input) {
          return input;
        },
        createScript: function (input) {
          return input;
        },
        createScriptURL: function (input) {
          var url = new URL(String(input), window.location.origin);
          if (url.origin === window.location.origin || url.origin === 'https://accounts.google.com') {
            return String(input);
          }
          throw new TypeError('Blocked untrusted script URL');
        }
      });
    }
  } catch (_err) {
    // Ignore if Trusted Types policy already exists or browser lacks support
  }

  try {
    var isLight = document.cookie.indexOf('theme=light') !== -1;
    if (!isLight) {
      document.documentElement.classList.add('dark');
    }
  } catch (_themeErr) {
    // Ignore cookie access errors in restricted frames
  }

  function activateAsyncStyles() {
    var links = document.querySelectorAll('link[data-async-css]');
    for (var i = 0; i < links.length; i += 1) {
      var link = links[i];
      if (link.media !== 'all') {
        link.media = 'all';
      }
    }
  }

  if (document.readyState === 'complete') {
    activateAsyncStyles();
  } else {
    window.addEventListener('load', activateAsyncStyles, { once: true });
    document.addEventListener('DOMContentLoaded', function () {
      var links = document.querySelectorAll('link[data-async-css]');
      for (var i = 0; i < links.length; i += 1) {
        (function (lnk) {
          if (lnk.sheet) {
            lnk.media = 'all';
          } else {
            lnk.addEventListener('load', function () {
              lnk.media = 'all';
            }, { once: true });
          }
        })(links[i]);
      }
    }, { once: true });
  }
})();
