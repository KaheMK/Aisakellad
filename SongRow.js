import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function SongRow({ song, user }) {
  const [description, setDescription] = useState(song.description || "");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const { error } = await supabase
      .from("Songs1")
      .update({ description })
      .eq("id", song.id);

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000); // ✓ kaob 2s pärast
    }
  };

  return (
    <div className="song-row">
      <div className="title">{song.title}</div>

      {user.role === "admin" ? (
        <div className="editable-box">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}   // ⬅️ automaatne salvestus
            className="admin-textarea"
          />
          {saved && <span className="checkmark">✓</span>}
        </div>
      ) : (
        <textarea
          value={description}
          readOnly
          className="locked-textarea"
        />
      )}
    </div>
  );
}
