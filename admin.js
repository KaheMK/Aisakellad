// NB! Supabase klient on juba loodud player.js failis.
// Siin kasutame sama 'supabase' objekti.

// 📖 Modal avamine/sulgemine
document.getElementById("rulesBtn").addEventListener("click", () => {
  document.getElementById("rulesModal").style.display = "block";
});
document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("rulesModal").style.display = "none";
});



// 💬 Päise postkast
document.getElementById("postkast").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const msg = document.getElementById("postMessage").value.trim();
  if (!msg) return;

  const { data: { user } } = await supabase.auth.getUser();

  const payload = {
    song_id: null,
    message: msg
    // NB! created_at täidab Supabase ise
  };

  

  const { error } = await supabase.from("Messages").insert(payload);
  if (error) {
    console.error("Insert error:", error);
    alert("Sõnumi salvestamine ebaõnnestus.");
    return;
  }

  document.getElementById("postMessage").value = "";
  alert("Sõnum salvestatud!");
});

// 🔒 Admin nupp
document.getElementById("adminBtn").addEventListener("click", async () => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const email = prompt("Sisesta email");
    const password = prompt("Sisesta parool");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Sisselogimine ebaõnnestus: " + error.message);
      return;
    }
  }

  document.getElementById("adminPanel").style.display = "block";
  await loadMessages();
  await loadNotes();
});

// ❌ Admin sulgemine
document.getElementById("adminClose").addEventListener("click", async () => {
  document.getElementById("adminPanel").style.display = "none";
  await supabase.auth.signOut();
  alert("Oled välja logitud.");
});

// 🔄 Värskenda, filter, otsing
document.getElementById("msgRefresh").addEventListener("click", () => loadMessages());
document.getElementById("msgFilter").addEventListener("change", () => loadMessages());
document.getElementById("msgSearch").addEventListener("input", () => loadMessages(true));

// 📥 Messages laadimine
async function loadMessages(skipQuery = false) {
  const { data: messages, error } = await supabase
    .from("Messages")
    .select("id, created_at, message, song_id, user_id")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Messages viga:", error);
    return;
  }

  const filter = document.getElementById("msgFilter").value;
  const search = document.getElementById("msgSearch").value.toLowerCase();
  const tbody = document.getElementById("messages-body");
  tbody.innerHTML = "";

  messages.forEach(r => {
    const isHeader = r.song_id === null;
    const isSong = r.song_id !== null;
    const matchesFilter =
      (filter === "all") ||
      (filter === "header" && isHeader) ||
      (filter === "song" && isSong);
    const matchesSearch = skipQuery ? r.message.toLowerCase().includes(search) : true;

    if (matchesFilter && matchesSearch) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td>${r.message}</td>
        <td>${r.song_id ?? ""}</td>
        <td>${r.user_id ?? "-"}</td>
      `;
      if (isHeader) {
        tr.style.backgroundColor = "#f9f9f9";
      }
      tbody.appendChild(tr);
    }
  });
}
// 📥 SongNotes laadimine
async function loadNotes() {
  const { data: songs } = await supabase
    .from("Songs1")
    .select("id, title");

  const { data: notes } = await supabase
    .from("SongNotes")
    .select("song_id, description");

  const tbody = document.getElementById("notes-body");
  tbody.innerHTML = "";

  // Kontrollime kas admin on sees
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = !!user;
  console.log("Kas admin:", isAdmin, user);

  songs.forEach(song => {
    const note = notes?.find(n => n.song_id === song.id);

    const tr = document.createElement("tr");

    // ID veerg
    const tdId = document.createElement("td");
    tdId.textContent = song.id;
    tr.appendChild(tdId);

    // Pealkiri (readonly must kast Songs1.title)
    const tdTitle = document.createElement("td");
    const titleBox = document.createElement("textarea");
    titleBox.classList.add("description", "locked");
    titleBox.value = song.title;
    titleBox.setAttribute("readonly", true);
    tdTitle.appendChild(titleBox);
    tr.appendChild(tdTitle);

    // Lisainfo (SongNotes.description)
    const tdDesc = document.createElement("td");
    const descBox = document.createElement("textarea");
    descBox.classList.add("description");
    descBox.value = note?.description ?? "";

    if (isAdmin) {
      descBox.classList.add("admin");
      descBox.removeAttribute("readonly");
    } else {
      descBox.classList.add("locked");
      descBox.setAttribute("readonly", true);
    }

    tdDesc.appendChild(descBox);
    tr.appendChild(tdDesc);

    // Salvesta nupp ainult adminile
    if (isAdmin) {
      const tdSave = document.createElement("td");
      const saveBtn = document.createElement("button");
      saveBtn.className = "save-note";
      saveBtn.textContent = "💾 Salvesta";

      // ⬇️ Salvestusloogika
      saveBtn.addEventListener("click", async () => {
        const newDesc = descBox.value;
        const { error } = await supabase
          .from("SongNotes")
          .upsert({ song_id: song.id, description: newDesc });

        if (error) {
          console.error("SongNotes update error:", error);
        } else {
          console.log("SongNotes updated for song", song.id);
        }
      });

      tdSave.appendChild(saveBtn);
      tr.appendChild(tdSave);
    }

    tbody.appendChild(tr);
  });
}




// 🔔 Realtime kuulamine Messages tabelile
supabase.channel('messages-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'Messages' }, payload => {
    console.log("Messages muutus:", payload);
    loadMessages();
  })
  .subscribe();










