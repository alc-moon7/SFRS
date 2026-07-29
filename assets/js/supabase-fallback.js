// Lightweight Supabase fallback — works without CDN
// Reads session from localStorage (set by the CDN-free login page)
// Provides enough API for dashboards: getSession(), from(), auth.onAuthStateChange()

(function() {
  if (window.supabase && window.supabase.createClient) return; // CDN loaded, skip

  var SUPABASE_URL = "https://mstotzwqfbcvpcdgrnxy.supabase.co";
  var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zdG90endxZmJjdnBjZGdybnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODEzNTAsImV4cCI6MjA4MjA1NzM1MH0.JbIf3inEy0Ks5JPVGQfFycBXenIGDGtqUBjYB1JeAcw";
  var sessionCache = null;

  function getSessionFromStorage() {
    try {
      // Try multiple localStorage keys
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf("supabase") !== -1 && key.indexOf("auth") !== -1) {
          var raw = localStorage.getItem(key);
          if (raw) {
            var data = JSON.parse(raw);
            if (data && data.access_token && data.user) {
              // Check if expired
              if (data.expires_at && data.expires_at < Date.now()) return null;
              return data;
            }
          }
        }
      }
    } catch(e) {}
    // Also try the specific key our login page sets
    try {
      var hostKey = "sb-" + SUPABASE_URL.split("//")[1] + "-auth-token";
      var raw = localStorage.getItem(hostKey);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.access_token && data.expires_at > Date.now()) return data;
      }
    } catch(e) {}
    return null;
  }

  function getSession() {
    if (sessionCache && sessionCache.expires_at > Date.now()) return sessionCache;
    sessionCache = getSessionFromStorage();
    return sessionCache;
  }

  // Minimal Supabase client
  window.supabase = {
    createClient: function(url, key) {
      var listeners = [];

      function checkSession() {
        var s = getSession();
        if (s) return { session: s, user: s.user };
        return { session: null };
      }

      return {
        auth: {
          getSession: async function() {
            return { data: checkSession(), error: null };
          },
          onAuthStateChange: function(cb) {
            listeners.push(cb);
            // Fire immediately with current state
            var s = getSession();
            if (s) {
              setTimeout(function() { cb("SIGNED_IN", s); }, 100);
            } else {
              setTimeout(function() { cb("SIGNED_OUT", null); }, 2000);
            }
            return {
              data: {
                subscription: { unsubscribe: function() { var idx = listeners.indexOf(cb); if (idx >= 0) listeners.splice(idx, 1); } }
              }
            };
          },
          signOut: async function() {
            // Clear all supabase keys
            for (var i = localStorage.length - 1; i >= 0; i--) {
              var key = localStorage.key(i);
              if (key && (key.indexOf("supabase") !== -1 || key.indexOf("sb-") === 0)) {
                localStorage.removeItem(key);
              }
            }
            sessionCache = null;
            listeners.forEach(function(cb) { try { cb("SIGNED_OUT", null); } catch(e) {} });
            return { error: null };
          }
        },
        from: function(table) {
          var s = getSession();
          var headers = { apikey: ANON_KEY, "Content-Type": "application/json" };
          if (s && s.access_token) { headers["Authorization"] = "Bearer " + s.access_token; }
          var chain = {
            _url: SUPABASE_URL + "/rest/v1/" + table,
            _headers: headers,
            _filters: [],
            select: function(cols) { this._select = cols || "*"; return this; },
            eq: function(col, val) { this._filters.push(col + "=eq." + encodeURIComponent(val)); return this; },
            neq: function(col, val) { this._filters.push(col + "=neq." + encodeURIComponent(val)); return this; },
            or: function(expr) { this._filters.push("or=(" + encodeURIComponent(expr) + ")"); return this; },
            order: function(col, opts) { this._order = col + (opts && opts.ascending === false ? ".desc" : ""); return this; },
            limit: function(n) { this._limit = n; return this; },
            maybeSingle: async function() {
              var data = await this._exec();
              if (data && data.length > 0) return { data: data[0], error: null };
              return { data: null, error: null };
            },
            _exec: async function() {
              var url = this._url + "?select=" + (this._select || "*");
              if (this._filters.length) url += "&" + this._filters.join("&");
              if (this._order) url += "&order=" + this._order;
              if (this._limit) url += "&limit=" + this._limit;
              var resp = await fetch(url, { headers: this._headers });
              if (!resp.ok) return null;
              return await resp.json();
            },
            // insert/update need POST/PATCH
            insert: async function(data) {
              var url = this._url;
              var resp = await fetch(url, { method: "POST", headers: this._headers, body: JSON.stringify(data) });
              if (!resp.ok) { var e = await resp.text(); return { error: { message: e } }; }
              return { data: await resp.json(), error: null };
            },
            update: async function(data) {
              var url = this._url + "?" + this._filters.join("&");
              var resp = await fetch(url, { method: "PATCH", headers: this._headers, body: JSON.stringify(data) });
              if (!resp.ok) { var e = await resp.text(); return { error: { message: e } }; }
              return { error: null };
            }
          };
          // make chain directly callable like Supabase: sup.from("table").select("*").eq("id",1)
          // Add a then/catch stub so Promise.all works
          var originalEq = chain.eq;
          chain.eq = function(col, val) {
            originalEq.call(this, col, val);
            return this;
          };
          return chain;
        },
        rpc: async function(fn, args) {
          var s = getSession();
          var headers = { apikey: ANON_KEY, "Content-Type": "application/json" };
          if (s && s.access_token) { headers["Authorization"] = "Bearer " + s.access_token; }
          var resp = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: headers, body: JSON.stringify(args || {}) });
          if (!resp.ok) return { data: null, error: { message: await resp.text() } };
          return { data: await resp.json(), error: null };
        }
      };
    }
  };
})();