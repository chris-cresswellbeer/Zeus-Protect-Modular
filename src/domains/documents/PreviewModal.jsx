function PreviewModal({ doc, onClose, Z, font }) {
  if (!doc) return null;
  const ext = (doc.ext || "").toUpperCase();
  const isImage = ["PNG","JPG","JPEG","GIF","WEBP","SVG"].includes(ext);
  const isPDF   = ext === "PDF";
  const isHTML  = ext === "HTML";
  const isText  = ["TXT","CSV","MD"].includes(ext);

  // Decode base64 HTML back to a string for srcdoc rendering
  const htmlContent = isHTML && doc.fileData ? (() => {
    try {
      const b64 = doc.fileData.split(",")[1];
      return decodeURIComponent(escape(atob(b64)));
    } catch(e) {
      try { return atob(doc.fileData.split(",")[1]); }
      catch(e2) { return "<p>Unable to decode document.</p>"; }
    }
  })() : null;

  const headerIcon = isImage?"🖼️":isPDF?"📕":isHTML?"📋":isText?"📄":"📎";

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:`linear-gradient(160deg,${Z.navyMd},${Z.navyDk})`,borderRadius:20,width:"100%",maxWidth:isHTML?1100:900,maxHeight:"92vh",display:"flex",flexDirection:"column",border:`1px solid ${Z.borderMd}`,boxShadow:"0 40px 100px rgba(0,0,0,.7)"}}>

        {/* Modal header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${Z.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <span style={{fontSize:22}}>{headerIcon}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:15,color:Z.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{doc.title}</div>
            <div style={{color:Z.muted,fontSize:11,marginTop:2}}>{doc.size} · {doc.date}{doc.fileName?` · ${ext}`:""}</div>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            {doc.fileData && (
              <a href={doc.fileData} download={doc.fileName||doc.title}
                style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,textDecoration:"none"}}>
                ↓ Download
              </a>
            )}
            <button onClick={onClose} style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>✕</button>
          </div>
        </div>

        {/* Preview area */}
        <div style={{flex:1,overflow:"auto",minHeight:0,borderRadius:"0 0 20px 20px"}}>
          {!doc.fileData ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,color:Z.muted,gap:12}}>
              <span style={{fontSize:48}}>📎</span>
              <p style={{fontSize:14,margin:0}}>No file data available for preview.</p>
            </div>
          ) : isImage ? (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:Z.overlay}}>
              <img src={doc.fileData} alt={doc.title} style={{maxWidth:"100%",maxHeight:"70vh",borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}/>
            </div>
          ) : isPDF ? (
            <iframe src={doc.fileData} title={doc.title} style={{width:"100%",height:"75vh",border:"none",borderRadius:"0 0 20px 20px",background:"#fff"}}/>
          ) : isHTML ? (
            <iframe
              srcDoc={htmlContent}
              title={doc.title}
              sandbox="allow-same-origin"
              style={{width:"100%",height:"75vh",border:"none",borderRadius:"0 0 20px 20px",background:"#fff",display:"block"}}
            />
          ) : isText ? (
            <TextPreview fileData={doc.fileData} Z={Z}/>
          ) : (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,color:Z.muted,gap:16,padding:32}}>
              <span style={{fontSize:56}}>{ext==="DOCX"||ext==="DOC"?"📘":ext==="XLSX"||ext==="XLS"?"📗":ext==="PPTX"||ext==="PPT"?"📙":"📎"}</span>
              <p style={{fontSize:15,fontWeight:600,color:Z.white,margin:0,textAlign:"center"}}>{doc.title}</p>
              <p style={{fontSize:13,color:Z.muted,margin:0,textAlign:"center"}}>
                {ext} files can't be previewed in the browser.<br/>Download the file to open it.
              </p>
              {doc.fileData && (
                <a href={doc.fileData} download={doc.fileName||doc.title}
                  style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",borderRadius:10,padding:"11px 28px",fontWeight:700,fontSize:14,textDecoration:"none",fontFamily:font,marginTop:8}}>
                  ↓ Download {ext}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { PreviewModal };
