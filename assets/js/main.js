(() => {
  // Theme switch
  const body = document.body;
  const lamp = document.getElementById("mode");
  const data = body.getAttribute("data-theme");

  const initTheme = (state) => {
    if (state === "dark") {
      body.setAttribute("data-theme", "dark");
    } else if (state === "light") {
      body.removeAttribute("data-theme");
    } else {
      localStorage.setItem("theme", data);
    }
  };

  const toggleTheme = (state) => {
    if (state === "dark") {
      localStorage.setItem("theme", "light");
      body.removeAttribute("data-theme");
    } else if (state === "light") {
      localStorage.setItem("theme", "dark");
      body.setAttribute("data-theme", "dark");
    } else {
      initTheme(state);
    }
  };

  initTheme(localStorage.getItem("theme"));

  lamp.addEventListener("click", () =>
    toggleTheme(localStorage.getItem("theme"))
  );

  // Blur the content when the menu is open
  const cbox = document.getElementById("menu-trigger");

  cbox.addEventListener("change", function () {
    const area = document.querySelector(".wrapper");
    this.checked
      ? area.classList.add("blurry")
      : area.classList.remove("blurry");
  });
})();

function toggleDropdown(id)
{
  document.getElementById(id).classList.toggle("show");
}
  
// Close the dropdown menu if the user clicks outside of it
window.onclick = function(event)
{
  if (!event.target.matches('.dropbtn')) {
    var dropdowns = document.getElementsByClassName("dropdown-content");
    var i;
    for (i = 0; i < dropdowns.length; i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.classList.contains('show')) {
        openDropdown.classList.remove('show');
      }
    }
  }
}