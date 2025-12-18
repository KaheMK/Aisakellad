// Supabase ühendus
const supabase = window.supabase.createClient("https://mkghndaoiqfapflqcuwu.supabase.co", 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZ2huZGFvaXFmYXBmbHFjdXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjE5MzgsImV4cCI6MjA4MTI5NzkzOH0.FZ7bq2349JlrGkj1KwrTGms9Ayii26OmOFtUocP_-1M"); // sinu anon key


let audio = null;
let progressInterval = null;
// Laulude tabeli laadimine

async function loadTable() {
  const { data, error } = await supabase
    .from("Songs1")
    .select("id, title, file, rating, rating_clicks, plays, downloads, comment")
    .order("id");

  if (error) {
    console.error("Tabeli laadimise viga:", error);
    return;
  }

  const { data: notes, error: notesError } = await supabase
    .from("SongNotes")
    .select("song_id, description");

  if (notesError) {
    console.error("SongNotes laadimise viga:", notesError);
  }

  const tbody = document.querySelector("#songsTable tbody");
  tbody.innerHTML = "";

  data.forEach(song => {
    const note = notes?.find(n => n.song_id === song.id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${song.id}</td>
      <td>
        <div class="title">${song.title}</div>
        <textarea class="description" readonly style="background-color:#222; color:#fff;">
          ${note?.description ?? ""}
        </textarea>
      </td>
      <td>
        <button class="play" data-file="${song.file}">▶</button>
        <button class="pause">⏸</button>
        <span class="plays">Kuulatud: ${song.plays ?? 0}x</span>
        <div class="progress"><div class="progress-bar"></div></div>
        <span class="time">0:00</span> / <span class="duration">0:00</span>
      </td>
      <td>
        <div class="stars-row">
          ${[1,2,3,4,5,6,7,8,9,10].map(n => `<span data-value="${n}">★</span>`).join("")}
        </div>
        <div class="rating-info">
          Keskmine: ${song.rating?.toFixed(1) ?? "0.0"}<br>
          Hindajaid: ${song.rating_clicks ?? 0}
        </div>
      </td>
      <td>
        <textarea class="comment" placeholder="Sisesta kommentaar"></textarea>
        <button class="save-comment">💬 Salvesta</button>
        <button class="clear-comment">✖ Tühjenda</button>
        <div class="comment-info">Kommentaare: ${song.comment ?? 0}</div>
      </td>
      <td>
        <button class="download" data-file="${song.file}">⬇</button>
        <span class="downloads">Laaditud: ${song.downloads ?? 0}x</span>
      </td>
    `;
    tbody.appendChild(tr);

    // ⭐ värvi tärnid keskmise järgi
    const avg = song.rating ?? 0;
    const fullStars = Math.floor(avg);
    const stars = tr.querySelectorAll(".stars-row span");
    stars.forEach(star => {
      const val = parseInt(star.dataset.value, 10);
      if (val <= fullStars) star.classList.add("active");
    });
  });
}

// Klikkide käsitlemine
document.querySelector("#songsTable tbody").addEventListener("click", async ev => {
  const t = ev.target;
  const row = t.closest("tr");
  if (!row) return;
  const songId = row.children[0].textContent;

  const playsSpan = row.querySelector(".plays");
  const downloadsSpan = row.querySelector(".downloads");
  const progressBar = row.querySelector(".progress-bar");
  const timeSpan = row.querySelector(".time");

  // 🎵 Play
  if (t.classList.contains("play")) {
    const file = t.getAttribute("data-file");
    const { data: urlData } = await supabase.storage.from("Musa").createSignedUrl(file, 3600);
    if (!urlData?.signedUrl) return;

    if (audio) { audio.pause(); clearInterval(progressInterval); }
    audio = new Audio(urlData.signedUrl);

    audio.onloadedmetadata = () => {
      const totalMins = Math.floor(audio.duration / 60);
      const totalSecs = Math.floor(audio.duration % 60).toString().padStart(2, "0");
      row.querySelector(".duration").textContent = `${totalMins}:${totalSecs}`;
    };

    audio.onended = () => {
      clearInterval(progressInterval);
      progressBar.style.width = "0%";
      timeSpan.textContent = "0:00";
      audio = null;
    };

    audio.play();

    let currentPlays = parseInt((playsSpan.textContent.match(/\d+/) || [0])[0], 10) + 1;
    playsSpan.textContent = `Kuulatud: ${currentPlays}x`;
    await supabase.from("Songs1").update({ plays: currentPlays }).eq("id", songId);

    progressInterval = setInterval(() => {
      if (audio && audio.duration > 0) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = percent + "%";
        const mins = Math.floor(audio.currentTime / 60);
        const secs = Math.floor(audio.currentTime % 60).toString().padStart(2, "0");
        timeSpan.textContent = `${mins}:${secs}`;
      }
    }, 250);
  }

  // ⏹ Pause
  if (t.classList.contains("pause")) {
    if (audio) {
      audio.pause();
      clearInterval(progressInterval);
      progressBar.style.width = "0%";
      timeSpan.textContent = "0:00";
      audio = null;
    }
  }

  // ⬇ Download
  if (t.classList.contains("download")) {
    const file = t.getAttribute("data-file");
    const { data: urlData } = await supabase.storage.from("Musa").createSignedUrl(file, 3600, { download: true });
    if (!urlData?.signedUrl) return;
    const a = document.createElement("a"); a.href = urlData.signedUrl; a.download = file; a.click();
    let currentDownloads = parseInt((downloadsSpan.textContent.match(/\d+/) || [0])[0], 10) + 1;
    downloadsSpan.textContent = `Laaditud: ${currentDownloads}x`;
    await supabase.from("Songs1").update({ downloads: currentDownloads }).eq("id", songId);
  }

  // ⭐ Rating
  if (t.dataset.value) {
    const clicked = parseInt(t.dataset.value, 10);
    const lastRatedKey = `lastRated_${songId}`;
    const lastRated = localStorage.getItem(lastRatedKey);
    const now = Date.now();

    if (lastRated && (now - parseInt(lastRated, 10)) < 60 * 60 * 1000) {
      alert("Sama lugu saab hinnata ainult kord tunnis selles brauseris.");
      return;
    }

    const stars = row.querySelectorAll(".stars-row span");
    stars.forEach(star => {
      const val = parseInt(star.dataset.value, 10);
      if (val <= clicked) star.classList.add("active");
      else star.classList.remove("active");
    });

    const { data: songData } = await supabase.from("Songs1").select("rating, rating_clicks").eq("id", songId).single();
    const newClicks = (songData?.rating_clicks || 0) + 1;
    const newAverage = ((songData?.rating || 0) * (newClicks - 1) + clicked) / newClicks;

    row.querySelector(".rating-info").innerHTML = `Keskmine: ${newAverage.toFixed(1)}<br>Hindajaid: ${newClicks}`;
    await supabase.from("Songs1").update({ rating: newAverage, rating_clicks: newClicks }).eq("id", songId);

    localStorage.setItem(lastRatedKey, now.toString());
  }

  // 💬 Comment
  if (t.classList.contains("save-comment")) {
    const textarea = row.querySelector(".comment");
    const commentText = textarea.value.trim();
    if (!commentText) return;
    await supabase.from("Messages").insert({ song_id: parseInt(songId, 10), message: commentText, created_at: new Date() });
    const { data: songData } = await supabase.from("Songs1").select("comment").eq("id", songId).single();
    const newCount = (songData?.comment || 0) + 1;
    await supabase.from("Songs1").update({ comment: newCount }).eq("id", songId);
    row.querySelector(".comment-info").textContent = `Kommentaare: ${newCount}`;
    textarea.value = "";
  }

  // ✖ Clear comment
  if (t.classList.contains("clear-comment")) {
    const textarea = row.querySelector(".comment");
    textarea.value = "";
  }
});

// Realtime kuulamine Messages tabelile
supabase.channel('messages-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'Messages' }, payload => {
    console.log("Messages muutus:", payload);
    loadMessages();
  })
  .subscribe();

loadTable()





