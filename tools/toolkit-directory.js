(function initDirectory() {
  "use strict";
  const finder = document.getElementById("tool-finder");
  const search = document.getElementById("tool-search");
  const clear = document.getElementById("clear-search");
  const empty = document.getElementById("no-results");
  const status = document.getElementById("filter-status");
  const filters = [...document.querySelectorAll("[data-filter]")];
  const normalize = value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const groups = [...document.querySelectorAll("[data-category]")].map(section => ({
    section,
    key: section.dataset.category,
    cards: [...section.querySelectorAll(".tool-card")].map(card => ({
      card, searchText: normalize(`${card.textContent} ${card.dataset.search}`)
    }))
  }));
  let category = "all";
  function update() {
    const words = normalize(search.value).split(" ").filter(Boolean);
    let hasMatch = false;
    for (const group of groups) {
      let showGroup = false;
      for (const item of group.cards) {
        const matches = (category === "all" || group.key === category) && words.every(word => item.searchText.includes(word));
        item.card.hidden = !matches;
        if (matches) showGroup = true;
      }
      group.section.hidden = !showGroup;
      if (showGroup) hasMatch = true;
    }
    clear.hidden = !search.value;
    empty.hidden = hasMatch;
    status.textContent = hasMatch ? "Tools shown below." : "No matching tools.";
  }
  function choose(value) {
    category = value;
    filters.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === category)));
    update();
  }
  filters.forEach(button => button.addEventListener("click", () => choose(button.dataset.filter)));
  search.addEventListener("input", update);
  clear.addEventListener("click", () => {
    search.value = "";
    update();
    search.focus();
  });
  search.addEventListener("keydown", event => {
    if (event.key === "Escape" && search.value) {
      search.value = "";
      update();
    }
  });
  document.getElementById("reset-search").addEventListener("click", () => {
    search.value = "";
    choose("all");
    search.focus();
  });
  update();
  finder.hidden = false;
})();
