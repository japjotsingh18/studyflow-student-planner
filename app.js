const STORAGE_KEY = "studyflow.tasks.v1";
const state = { tasks: [], view: "all", search: "", course: "all", sort: "smart" };
const $ = (selector) => document.querySelector(selector);

const seedTasks = () => {
  const today = new Date();
  const date = (days) => {
    const d = new Date(today); d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };
  return [
    { id: crypto.randomUUID(), title: "Finish Git competency demonstration", course: "CSE 485", type: "Project", date: date(0), time: "20:00", priority: "high", estimate: 120, notes: "Capture branches, focused commits, a pull request, and conflict resolution.", completed: false },
    { id: crypto.randomUUID(), title: "Write Growing a Competency summary", course: "CSE 485", type: "Assignment", date: date(0), time: "23:59", priority: "high", estimate: 90, notes: "Use the provided template and export the final two-page report as PDF.", completed: false },
    { id: crypto.randomUUID(), title: "Review Selfmadee sprint tasks", course: "Capstone", type: "Project", date: date(1), time: "18:00", priority: "medium", estimate: 45, notes: "Check owners, blockers, acceptance criteria, and next steps.", completed: false },
    { id: crypto.randomUUID(), title: "Plan next week’s study blocks", course: "Personal", type: "Study", date: date(3), time: "17:00", priority: "low", estimate: 20, notes: "Reserve realistic blocks around deadlines.", completed: false }
  ];
};

function load() {
  try { state.tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedTasks(); }
  catch { state.tasks = seedTasks(); }
  save();
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks)); }
function dueAt(task) { return new Date(`${task.date}T${task.time || "23:59"}`); }
function isSameDay(a,b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function priorityWeight(p) { return ({high: 3, medium: 2, low: 1})[p] || 0; }
function smartScore(task) {
  const hours = (dueAt(task) - new Date()) / 36e5;
  const urgency = hours < 0 ? 100 : hours < 24 ? 70 : hours < 48 ? 45 : Math.max(0, 25 - hours/24);
  return urgency + priorityWeight(task.priority) * 14 - Math.min(task.estimate/120, 6);
}
function relativeDue(task) {
  const due = dueAt(task), now = new Date(), diff = due-now, days = Math.ceil(diff/864e5);
  const time = due.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  if (diff < 0) return `Overdue · ${due.toLocaleDateString([], {month:"short",day:"numeric"})}`;
  if (isSameDay(due, now)) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return `${due.toLocaleDateString([], {month:"short",day:"numeric"})} · ${time}`;
}
function formatMinutes(minutes) { const h=Math.floor(minutes/60), m=minutes%60; return h ? `${h}h${m?` ${m}m`:""}` : `${m}m`; }
function escapeText(value="") { return value.replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]); }

function filteredTasks() {
  const now = new Date();
  let tasks = state.tasks.filter(t => {
    if (state.view === "today" && (!isSameDay(dueAt(t), now) || t.completed)) return false;
    if (state.view === "overdue" && (dueAt(t) >= now || t.completed)) return false;
    if (state.view === "upcoming" && (dueAt(t) < now || t.completed)) return false;
    if (state.view === "completed" && !t.completed) return false;
    if (state.view === "all" && t.completed) return false;
    if (state.course !== "all" && t.course !== state.course) return false;
    return `${t.title} ${t.course} ${t.notes}`.toLowerCase().includes(state.search.toLowerCase());
  });
  return tasks.sort((a,b) => {
    if (state.sort === "due") return dueAt(a)-dueAt(b);
    if (state.sort === "priority") return priorityWeight(b.priority)-priorityWeight(a.priority);
    if (state.sort === "course") return a.course.localeCompare(b.course);
    return smartScore(b)-smartScore(a);
  });
}

function render() {
  const now = new Date();
  const open = state.tasks.filter(t=>!t.completed), complete = state.tasks.filter(t=>t.completed);
  const progress = state.tasks.length ? Math.round(complete.length/state.tasks.length*100) : 0;
  $("#dateLabel").textContent = now.toLocaleDateString([], {weekday:"long", month:"long", day:"numeric"}).toUpperCase();
  $("#greeting").textContent = `${now.getHours()<12?"Good morning":now.getHours()<18?"Good afternoon":"Good evening"}, Japjot`;
  $("#allCount").textContent = open.length;
  $("#todayCount").textContent = open.filter(t=>isSameDay(dueAt(t),now)).length;
  $("#overdueCount").textContent = open.filter(t=>dueAt(t)<now).length;
  $("#progressValue").textContent = `${progress}%`;
  $("#progressBar").style.width = `${progress}%`;
  $("#progressCopy").textContent = `${complete.length} of ${state.tasks.length} tasks completed`;
  $("#dueSoonValue").textContent = open.filter(t=>{const h=(dueAt(t)-now)/36e5;return h>=0&&h<=48}).length;
  const minutes = open.reduce((sum,t)=>sum+Number(t.estimate||0),0);
  $("#timeValue").textContent = formatMinutes(minutes);
  renderFocus(open);
  renderCourses();
  renderTasks(filteredTasks());
}

function renderFocus(open) {
  const top = [...open].sort((a,b)=>smartScore(b)-smartScore(a)).slice(0,3);
  $("#focusCards").innerHTML = top.length ? top.map(t=>`<article class="focus-card ${t.priority}" data-edit="${t.id}">
    <span class="badge ${t.priority}">${t.priority.toUpperCase()}</span>
    <h3>${escapeText(t.title)}</h3>
    <p>${escapeText(t.course)} · ${relativeDue(t)} · ${formatMinutes(Number(t.estimate))}</p>
  </article>`).join("") : `<article class="focus-card"><span class="badge low">CLEAR</span><h3>You’re caught up</h3><p>Add a task when you’re ready to plan what’s next.</p></article>`;
}
function renderCourses() {
  const select=$("#courseFilter"), current=state.course;
  const courses=[...new Set(state.tasks.map(t=>t.course))].sort();
  select.innerHTML=`<option value="all">All courses</option>`+courses.map(c=>`<option value="${escapeText(c)}">${escapeText(c)}</option>`).join("");
  select.value = courses.includes(current) ? current : "all";
}
function renderTasks(tasks) {
  const titles={all:"All tasks",today:"Due today",overdue:"Overdue tasks",upcoming:"Upcoming tasks",completed:"Completed tasks"};
  $("#viewTitle").textContent=titles[state.view];
  $("#emptyState").hidden=tasks.length>0;
  $("#taskList").innerHTML=tasks.map(t=>{
    const overdue=!t.completed&&dueAt(t)<new Date();
    return `<article class="task-row ${t.completed?"completed":""}">
      <button class="check ${t.completed?"checked":""}" data-toggle="${t.id}" aria-label="${t.completed?"Mark incomplete":"Mark complete"}">${t.completed?"✓":""}</button>
      <div class="task-main"><h3>${escapeText(t.title)}</h3><p><span class="course-dot"></span>${escapeText(t.course)} · ${escapeText(t.type)}</p></div>
      <span class="badge ${t.priority}">${t.priority}</span>
      <span class="task-meta due ${overdue?"overdue":""}">${relativeDue(t)}</span>
      <span class="task-meta">◷ ${formatMinutes(Number(t.estimate))}</span>
      <button class="edit-button" data-edit="${t.id}" aria-label="Edit ${escapeText(t.title)}">•••</button>
    </article>`;
  }).join("");
}

function openModal(id=null) {
  const task=state.tasks.find(t=>t.id===id);
  $("#taskForm").reset(); $("#taskId").value=task?.id||"";
  $("#modalTitle").textContent=task?"Edit task":"Add a new task"; $("#deleteTask").hidden=!task;
  if(task){ $("#taskTitle").value=task.title; $("#taskCourse").value=task.course; $("#taskType").value=task.type; $("#taskDate").value=task.date; $("#taskTime").value=task.time; $("#taskPriority").value=task.priority; $("#taskEstimate").value=task.estimate; $("#taskNotes").value=task.notes||""; }
  else {
    const now=new Date(), pad=(n)=>String(n).padStart(2,"0");
    $("#taskDate").value=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    $("#taskTime").value="23:59"; $("#taskEstimate").value=60;
  }
  $("#taskModal").showModal(); setTimeout(()=>$("#taskTitle").focus(),0);
}
function closeModal(){ $("#taskModal").close(); }
function toast(message){ const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200); }

$("#openTaskModal").addEventListener("click",()=>openModal());
$("#closeTaskModal").addEventListener("click",closeModal); $("#cancelTask").addEventListener("click",closeModal);
$("#taskForm").addEventListener("submit",e=>{
  e.preventDefault(); const id=$("#taskId").value;
  const task={id:id||crypto.randomUUID(),title:$("#taskTitle").value.trim(),course:$("#taskCourse").value.trim(),type:$("#taskType").value,date:$("#taskDate").value,time:$("#taskTime").value,priority:$("#taskPriority").value,estimate:Number($("#taskEstimate").value),notes:$("#taskNotes").value.trim(),completed:state.tasks.find(t=>t.id===id)?.completed||false};
  if(id) state.tasks=state.tasks.map(t=>t.id===id?task:t); else state.tasks.push(task);
  save();closeModal();render();toast(id?"Task updated":"Task added");
});
$("#deleteTask").addEventListener("click",()=>{const id=$("#taskId").value;state.tasks=state.tasks.filter(t=>t.id!==id);save();closeModal();render();toast("Task deleted");});
document.addEventListener("click",e=>{
  const toggle=e.target.closest("[data-toggle]"); if(toggle){const t=state.tasks.find(x=>x.id===toggle.dataset.toggle);t.completed=!t.completed;save();render();toast(t.completed?"Nice work — task completed":"Task reopened");return;}
  const edit=e.target.closest("[data-edit]"); if(edit) openModal(edit.dataset.edit);
  const nav=e.target.closest("[data-view]");
  if(nav){
    state.view=nav.dataset.view;
    document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n===nav));
    render();
    requestAnimationFrame(()=>document.querySelector(".tasks-panel").scrollIntoView({behavior:"smooth",block:"start"}));
  }
});
$("#searchInput").addEventListener("input",e=>{state.search=e.target.value;render();});
$("#courseFilter").addEventListener("change",e=>{state.course=e.target.value;render();});
$("#sortTasks").addEventListener("change",e=>{state.sort=e.target.value;render();});
load();render();
