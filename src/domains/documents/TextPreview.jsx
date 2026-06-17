import { useState } from "react";

function TextPreview({ fileData, Z }) {
  const [text, setText] = useState("");
  useState(()=>{
    try {
      const base64 = fileData.split(",")[1];
      setText(atob(base64));
    } catch(e) { setText("Unable to decode file."); }
  });
  // Use useEffect pattern via a ref trick — decode inline
  const decoded = (() => {
    try { return atob(fileData.split(",")[1]); } catch(e) { return "Unable to preview this file."; }
  })();
  return (
    <pre style={{margin:0,padding:24,color:"#e2e8f0",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"'Courier New',monospace",background:Z.overlay,minHeight:300}}>
      {decoded}
    </pre>
  );
}

export { TextPreview };
