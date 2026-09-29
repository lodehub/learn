/* Shared behaviour for the Learn hub: front door + per-child subject picker. */
(function () {
  "use strict";

  function loadJSON(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error("Failed to load " + path + " (" + res.status + ")");
      return res.json();
    });
  }

  function renderChildPicker(container, jsonPath) {
    loadJSON(jsonPath)
      .then(function (children) {
        container.innerHTML = "";
        children.forEach(function (child) {
          var a = document.createElement("a");
          a.className = "tile tile-child";
          a.href = "./" + child.slug + "/index.html";
          if (child.color) a.style.setProperty("--tile-color", child.color);
          var emoji = document.createElement("span");
          emoji.className = "tile-emoji";
          emoji.setAttribute("aria-hidden", "true");
          emoji.textContent = child.emoji || "📘";
          var label = document.createElement("span");
          label.className = "tile-label";
          label.textContent = child.name;
          a.appendChild(emoji);
          a.appendChild(label);
          container.appendChild(a);
        });
      })
      .catch(function (err) {
        container.innerHTML = '<p class="error">Could not load children.json</p>';
        console.error(err);
      });
  }

  function renderSubjectPicker(opts) {
    var manifestPath = opts.manifestPath;
    var heading = opts.heading;
    var homeLink = opts.homeLink;
    var backBtn = opts.backBtn;
    var toggleWrap = opts.toggleWrap;
    var toggleInput = opts.toggleInput;
    var grid = opts.grid;
    var emptyMsg = opts.emptyMsg;

    var manifest = null;
    var currentSubject = null;

    function subjectBySlug(slug) {
      return manifest.subjects.find(function (s) {
        return s.slug === slug;
      });
    }

    function showEmpty(text) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = text;
    }

    function render() {
      grid.innerHTML = "";
      emptyMsg.hidden = true;

      if (!currentSubject) {
        heading.textContent = "Choose a subject";
        backBtn.hidden = true;
        toggleWrap.hidden = true;

        if (!manifest.subjects.length) {
          showEmpty("No subjects yet.");
          return;
        }

        manifest.subjects.forEach(function (subject) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tile tile-subject";
          btn.textContent = subject.title;
          btn.addEventListener("click", function () {
            currentSubject = subject.slug;
            location.hash = subject.slug;
            render();
          });
          grid.appendChild(btn);
        });
        return;
      }

      var subject = subjectBySlug(currentSubject);
      if (!subject) {
        currentSubject = null;
        render();
        return;
      }

      heading.textContent = subject.title;
      backBtn.hidden = false;
      toggleWrap.hidden = false;

      var showArchived = toggleInput.checked;
      var tools = subject.tools.filter(function (t) {
        return showArchived ? true : t.status !== "archived";
      });

      if (!tools.length) {
        showEmpty(
          showArchived
            ? "No tools yet."
            : 'No current tools. Try "Show past years".'
        );
        return;
      }

      tools
        .slice()
        .sort(function (a, b) {
          return (b.year || 0) - (a.year || 0);
        })
        .forEach(function (tool) {
          var a = document.createElement("a");
          a.className =
            "tile tile-tool" + (tool.status === "archived" ? " tile-archived" : "");
          a.href = tool.path;
          if (tool.type === "pdf") a.target = "_blank";

          var label = document.createElement("span");
          label.className = "tile-label";
          label.textContent = tool.title;

          var meta = document.createElement("span");
          meta.className = "tile-meta";
          meta.textContent =
            (tool.year || "") + (tool.status === "archived" ? " · archived" : "");

          a.appendChild(label);
          a.appendChild(meta);
          grid.appendChild(a);
        });
    }

    backBtn.addEventListener("click", function () {
      currentSubject = null;
      location.hash = "";
      render();
    });

    toggleInput.addEventListener("change", render);

    window.addEventListener("hashchange", function () {
      var slug = location.hash.replace("#", "");
      currentSubject = slug && manifest && subjectBySlug(slug) ? slug : null;
      render();
    });

    loadJSON(manifestPath)
      .then(function (data) {
        manifest = data;
        var slug = location.hash.replace("#", "");
        currentSubject = slug && subjectBySlug(slug) ? slug : null;
        render();
      })
      .catch(function (err) {
        showEmpty("Could not load subjects.");
        console.error(err);
      });
  }

  window.Learn = {
    loadJSON: loadJSON,
    renderChildPicker: renderChildPicker,
    renderSubjectPicker: renderSubjectPicker
  };
})();
