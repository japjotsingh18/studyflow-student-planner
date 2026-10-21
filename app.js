const STORAGE_KEY = "studyflow.tasks.v1";

const state = {
  tasks: [],
  view: "all",
  search: "",
  course: "all",
  sort: "smart"
};

function getElement(selector) {
  return document.querySelector(selector);
}

function dateFromToday(numberOfDays) {
  const date = new Date();
  date.setDate(date.getDate() + numberOfDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function starterTasks() {
  return [
    { id: crypto.randomUUID(), title: "Finish Git competency demonstration", course: "CSE 485", type: "Project", date: dateFromToday(0), time: "20:00", priority: "high", estimate: 120, notes: "Capture branches, commits, a pull request, and conflict resolution.", completed: false },
    { id: crypto.randomUUID(), title: "Write Growing a Competency summary", course: "CSE 485", type: "Assignment", date: dateFromToday(0), time: "23:59", priority: "high", estimate: 90, notes: "Use the template and export the report as a PDF.", completed: false },
    { id: crypto.randomUUID(), title: "Review capstone sprint tasks", course: "Capstone", type: "Project", date: dateFromToday(1), time: "18:00", priority: "medium", estimate: 45, notes: "Check owners, blockers, and next steps.", completed: false },
    { id: crypto.randomUUID(), title: "Plan next week's study blocks", course: "Personal", type: "Study", date: dateFromToday(3), time: "17:00", priority: "low", estimate: 20, notes: "Set aside realistic study time before each deadline.", completed: false }
  ];
}

// Tasks are saved in the browser, so they remain after a refresh.
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function loadTasks() {
  try {
    const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    state.tasks = savedTasks || starterTasks();
  } catch (error) {
    state.tasks = starterTasks();
  }
  saveTasks();
}

function dueDate(task) {
  return new Date(`${task.date}T${task.time || "23:59"}`);
}

function sameDay(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

function priorityPoints(priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

// This score decides which tasks should appear first.
function smartScore(task) {
  const hoursLeft = (dueDate(task) - new Date()) / 3600000;
  let urgency = 0;
  if (hoursLeft < 0) urgency = 100;
  else if (hoursLeft < 24) urgency = 70;
  else if (hoursLeft < 48) urgency = 45;
  else urgency = Math.max(0, 25 - hoursLeft / 24);
  return urgency + priorityPoints(task.priority) * 14;
}

function dueText(task) {
  const due = dueDate(task);
  const now = new Date();
  const difference = due - now;
  const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (difference < 0) return `Overdue · ${due.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  if (sameDay(due, now)) return `Today · ${time}`;
  if (Math.ceil(difference / 86400000) === 1) return `Tomorrow · ${time}`;
  return `${due.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

function timeText(minutes) {
  const hours = Math.floor(minutes / 60);
  const extraMinutes = minutes % 60;
  if (hours === 0) return `${extraMinutes}m`;
  if (extraMinutes === 0) return `${hours}h`;
  return `${hours}h ${extraMinutes}m`;
}

function safeText(text = "") {
  const temporaryDiv = document.createElement("div");
  temporaryDiv.textContent = text;
  return temporaryDiv.innerHTML;
}

function visibleTasks() {
  const now = new Date();
  const tasks = state.tasks.filter(function (task) {
    if (state.view === "today" && (!sameDay(dueDate(task), now) || task.completed)) return false;
    if (state.view === "overdue" && (dueDate(task) >= now || task.completed)) return false;
    if (state.view === "upcoming" && (dueDate(task) < now || task.completed)) return false;
    if (state.view === "completed" && !task.completed) return false;
    if (state.view === "all" && task.completed) return false;
    if (state.course !== "all" && task.course !== state.course) return false;
    const words = `${task.title} ${task.course} ${task.notes}`.toLowerCase();
    return words.includes(state.search.toLowerCase());
  });

  return tasks.sort(function (first, second) {
    if (state.sort === "due") return dueDate(first) - dueDate(second);
    if (state.sort === "priority") return priorityPoints(second.priority) - priorityPoints(first.priority);
    if (state.sort === "course") return first.course.localeCompare(second.course);
    return smartScore(second) - smartScore(first);
  });
}

function renderFocus(openTasks) {
  const topTasks = [...openTasks].sort((a, b) => smartScore(b) - smartScore(a)).slice(0, 3);
  if (topTasks.length === 0) {
    getElement("#focusCards").innerHTML = `<article class="focus-card"><span class="badge low">CLEAR</span><h3>You're caught up</h3><p>Add a task when you are ready.</p></article>`;
    return;
  }
  getElement("#focusCards").innerHTML = topTasks.map((task) => `<article class="focus-card ${task.priority}" data-edit="${task.id}"><span class="badge ${task.priority}">${task.priority.toUpperCase()}</span><h3>${safeText(task.title)}</h3><p>${safeText(task.course)} · ${dueText(task)} · ${timeText(Number(task.estimate))}</p></article>`).join("");
}

function renderCourses() {
  const select = getElement("#courseFilter");
  const courses = [...new Set(state.tasks.map((task) => task.course))].sort();
  const options = courses.map((course) => `<option value="${safeText(course)}">${safeText(course)}</option>`).join("");
  select.innerHTML = `<option value="all">All courses</option>${options}`;
  select.value = courses.includes(state.course) ? state.course : "all";
}

function renderTaskList(tasks) {
  const titles = { all: "All tasks", today: "Due today", overdue: "Overdue tasks", upcoming: "Upcoming tasks", completed: "Completed tasks" };
  getElement("#viewTitle").textContent = titles[state.view];
  getElement("#emptyState").hidden = tasks.length > 0;
  getElement("#taskList").innerHTML = tasks.map(function (task) {
    const overdue = !task.completed && dueDate(task) < new Date();
    return `<article class="task-row ${task.completed ? "completed" : ""}"><button class="check ${task.completed ? "checked" : ""}" data-toggle="${task.id}" aria-label="Mark task complete">${task.completed ? "✓" : ""}</button><div class="task-main"><h3>${safeText(task.title)}</h3><p><span class="course-dot"></span>${safeText(task.course)} · ${safeText(task.type)}</p></div><span class="badge ${task.priority}">${task.priority}</span><span class="task-meta due ${overdue ? "overdue" : ""}">${dueText(task)}</span><span class="task-meta">◷ ${timeText(Number(task.estimate))}</span><button class="edit-button" data-edit="${task.id}" aria-label="Edit task">•••</button></article>`;
  }).join("");
}

function renderPage() {
  const now = new Date();
  const openTasks = state.tasks.filter((task) => !task.completed);
  const completedTasks = state.tasks.filter((task) => task.completed);
  const progress = state.tasks.length ? Math.round(completedTasks.length / state.tasks.length * 100) : 0;
  let greeting = "Good evening";
  if (now.getHours() < 12) greeting = "Good morning";
  else if (now.getHours() < 18) greeting = "Good afternoon";
  getElement("#dateLabel").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  getElement("#greeting").textContent = `${greeting}, Japjot`;
  getElement("#allCount").textContent = openTasks.length;
  getElement("#todayCount").textContent = openTasks.filter((task) => sameDay(dueDate(task), now)).length;
  getElement("#overdueCount").textContent = openTasks.filter((task) => dueDate(task) < now).length;
  getElement("#progressValue").textContent = `${progress}%`;
  getElement("#progressBar").style.width = `${progress}%`;
  getElement("#progressCopy").textContent = `${completedTasks.length} of ${state.tasks.length} tasks completed`;
  getElement("#dueSoonValue").textContent = openTasks.filter((task) => { const hours = (dueDate(task) - now) / 3600000; return hours >= 0 && hours <= 48; }).length;
  const minutes = openTasks.reduce((total, task) => total + Number(task.estimate || 0), 0);
  getElement("#timeValue").textContent = timeText(minutes);
  renderFocus(openTasks);
  renderCourses();
  renderTaskList(visibleTasks());
}

function openTaskForm(taskId = "") {
  const task = state.tasks.find((item) => item.id === taskId);
  getElement("#taskForm").reset();
  getElement("#taskId").value = task ? task.id : "";
  getElement("#modalTitle").textContent = task ? "Edit task" : "Add a new task";
  getElement("#deleteTask").hidden = !task;
  if (task) {
    ["Title", "Course", "Type", "Date", "Time", "Priority", "Estimate", "Notes"].forEach(function (name) {
      getElement(`#task${name}`).value = task[name.toLowerCase()] || "";
    });
  } else {
    getElement("#taskDate").value = dateFromToday(0);
    getElement("#taskTime").value = "23:59";
    getElement("#taskEstimate").value = 60;
  }
  getElement("#taskModal").showModal();
  getElement("#taskTitle").focus();
}

function closeTaskForm() { getElement("#taskModal").close(); }
function showMessage(message) {
  const toast = getElement("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

getElement("#openTaskModal").addEventListener("click", () => openTaskForm());
getElement("#closeTaskModal").addEventListener("click", closeTaskForm);
getElement("#cancelTask").addEventListener("click", closeTaskForm);
getElement("#taskForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const id = getElement("#taskId").value;
  const oldTask = state.tasks.find((task) => task.id === id);
  const task = { id: id || crypto.randomUUID(), title: getElement("#taskTitle").value.trim(), course: getElement("#taskCourse").value.trim(), type: getElement("#taskType").value, date: getElement("#taskDate").value, time: getElement("#taskTime").value, priority: getElement("#taskPriority").value, estimate: Number(getElement("#taskEstimate").value), notes: getElement("#taskNotes").value.trim(), completed: oldTask ? oldTask.completed : false };
  if (id) state.tasks = state.tasks.map((item) => item.id === id ? task : item);
  else state.tasks.push(task);
  saveTasks(); closeTaskForm(); renderPage(); showMessage(id ? "Task updated" : "Task added");
});
getElement("#deleteTask").addEventListener("click", function () {
  const id = getElement("#taskId").value;
  state.tasks = state.tasks.filter((task) => task.id !== id);
  saveTasks(); closeTaskForm(); renderPage(); showMessage("Task deleted");
});
document.addEventListener("click", function (event) {
  const checkButton = event.target.closest("[data-toggle]");
  if (checkButton) {
    const task = state.tasks.find((item) => item.id === checkButton.dataset.toggle);
    task.completed = !task.completed; saveTasks(); renderPage(); showMessage(task.completed ? "Task completed" : "Task reopened"); return;
  }
  const editButton = event.target.closest("[data-edit]");
  if (editButton) { openTaskForm(editButton.dataset.edit); return; }
  const navButton = event.target.closest("[data-view]");
  if (navButton) {
    state.view = navButton.dataset.view;
    document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button === navButton));
    renderPage(); getElement(".tasks-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
getElement("#searchInput").addEventListener("input", (event) => { state.search = event.target.value; renderPage(); });
getElement("#courseFilter").addEventListener("change", (event) => { state.course = event.target.value; renderPage(); });
getElement("#sortTasks").addEventListener("change", (event) => { state.sort = event.target.value; renderPage(); });

loadTasks();
renderPage();
