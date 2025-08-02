import React from "react";
import $ from "jquery";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import "/styles/buttons.css";
import "/styles/app.css";
import "katex/dist/katex.min.css";
import utils from "/src/utils.js";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Document,
  Text,
  Paragraph,
  Bold,
  Code,
  CodeBlock,
  Math,
  Italic,
  Strike,
  Subscript,
  Superscript,
  Underline,
  Blockquote,
  BulletList,
  OrderedList,
  TaskList,
  TaskItem,
  ListItem,
  Heading,
  TextAlign,
  HorizontalRule,
  EscapeChar,
  HardBreak,
  Highlight,
  UnsetActiveMark,
} from "/src/editorAddons.js";

const KeyCheck = createContext();
const Udata = createContext();
const EncText = createContext();
const CurrentNum = createContext();
const SyncTrigger = createContext();

function SyncTriggerProvider({ children }) {
  const [syncTrigger, setSyncTrigger] = useState(false);
  return (
    <SyncTrigger.Provider value={{ syncTrigger, setSyncTrigger }}>
      {children}
    </SyncTrigger.Provider>
  );
}

function CurrentKeyProvider({ children }) {
  const [enckey, setEnckey] = useState("");
  return (
    <KeyCheck.Provider value={{ enckey, setEnckey }}>
      {children}
    </KeyCheck.Provider>
  );
}

function EncTextProvider({ children }) {
  const [encrypted, setEncrypted] = useState("");
  const [currentNum, setCurrentNum] = useState(null);
  const currentEncrypted = useRef("");
  const childrenWithRef = React.Children.map(children, (child) => {
    return React.cloneElement(child, { currentEncrypted });
  });
  return (
    <EncText.Provider value={{ encrypted, setEncrypted }}>
      <CurrentNum.Provider value={{ currentNum, setCurrentNum }}>
        {childrenWithRef}
      </CurrentNum.Provider>
    </EncText.Provider>
  );
}

function EncKeyInput({ keyHash }) {
  const { enckey, setEnckey } = useContext(KeyCheck);
  return (
    <input
      id="enckey"
      type="password"
      placeholder="Encryption Key Here!"
      onChange={(e) => {
        try {
          if (utils.b2bMatch(e.target.value, keyHash)) {
            setEnckey(e.target.value);
          } else {
            throw new Error("Invalid Key");
          }
        } catch (err) {
          setEnckey(false);
        }
      }}
    />
  );
}

function KeyError() {
  const { enckey } = useContext(KeyCheck);
  return (
    <h4 className={enckey ? "hidden" : ""}>
      Enter a Valid Encryption Key to Proceed
    </h4>
  );
}

function Editor({ currentEncrypted }) {
  const { enckey } = useContext(KeyCheck);
  const { encrypted, setEncrypted } = useContext(EncText);
  const { currentNum } = useContext(CurrentNum);
  const [pending, setPending] = useState(encrypted);
  currentEncrypted.encrypted = encrypted;
  const suppressUpdate = useRef(false);
  const editor = useEditor({
    content: "",
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Code,
      CodeBlock,
      Italic,
      Strike,
      Underline,
      Subscript,
      Superscript,
      Blockquote,
      BulletList,
      OrderedList,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      ListItem,
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      HorizontalRule,
      EscapeChar,
      Math.configure({
        blockOptions: {
          onClick: (node, pos) => {
            const newCalculation = prompt(
              "Enter new calculation:",
              node.attrs.latex,
            );
            if (newCalculation && typeof pos === "number") {
              editor
                .chain()
                .setNodeSelection(pos)
                .updateBlockMath({ latex: newCalculation })
                .focus()
                .run();
            }
          },
        },
        inlineOptions: {
          onClick: (node) => {
            const newCalculation = prompt(
              "Enter new calculation:",
              node.attrs.latex,
            );
            if (newCalculation && typeof node?.pos === "number") {
              editor
                .chain()
                .setNodeSelection(node.pos)
                .updateInlineMath({ latex: newCalculation })
                .focus()
                .run();
            }
          },
        },
        katexOptions: {
          throwOnError: false,
        },
      }),
      HardBreak,
      Highlight.configure({
        multicolor: true,
      }),
      UnsetActiveMark,
    ],
    editable: false,
    onUpdate({ editor }) {
      if (suppressUpdate.current) {
        suppressUpdate.current = false;
        return;
      } else if (enckey) {
        try {
          currentEncrypted.current = utils.encrypt(editor.getHTML(), enckey);
          setPending(currentEncrypted.current);
        } catch (err) {
          console.log(err);
        }
      }
    },
  });
  useEffect(() => {
    if (editor) {
      suppressUpdate.current = true;
      editor.setEditable(!!enckey && !!currentNum);
      const decrypted = enckey
        ? utils.decrypt(currentEncrypted.current, enckey)
        : currentEncrypted.current;
      if (editor.getHTML() !== decrypted) {
        editor.commands.setContent(decrypted);
      }
    }
  }, [enckey, currentNum]);
  useEffect(() => {
    currentEncrypted.current = encrypted;
    setPending(currentEncrypted.current);
    if (editor) {
      const decrypted = enckey
        ? utils.decrypt(currentEncrypted.current, enckey)
        : currentEncrypted.current;
      if (editor.getHTML() !== decrypted) {
        suppressUpdate.current = true;
        editor.commands.setContent(decrypted);
      }
    }
  }, [encrypted]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (encrypted !== currentEncrypted.current) {
        setEncrypted(currentEncrypted.current);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [pending]);
  return (
    <div id="editor">
      <EditorContent
        editor={editor}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
    </div>
  );
}

function EntryList({ currentEncrypted }) {
  const { udata, setUdata } = useContext(Udata);
  const { encrypted, setEncrypted } = useContext(EncText);
  const { currentNum, setCurrentNum } = useContext(CurrentNum);
  const { syncTrigger } = useContext(SyncTrigger);
  const keys = Object.keys(udata).filter((k) => /^\d+$/.test(k));
  useEffect(
    (prev) => {
      if (!!currentNum) {
        setUdata((prev) => {
          return { ...prev, [currentNum]: encrypted };
        });
      }
    },
    [encrypted],
  );
  useEffect(
    (prev) => {
      if (!!currentNum) {
        setUdata((prev) => {
          return { ...prev, [currentNum]: currentEncrypted.current };
        });
      }
    },
    [syncTrigger],
  );
  return (
    <ul id="entrylist">
      {keys.map((key) => (
        <li key={key}>
          <button
            disabled={key === currentNum}
            onClick={() => {
              if (!!currentNum) {
                setUdata((prev) => {
                  return { ...prev, [currentNum]: currentEncrypted.current };
                });
              }
              setCurrentNum(key);
              setEncrypted(udata[key]);
            }}
          >
            {key}
          </button>
        </li>
      ))}
      <li>
        <button
          onClick={(prev) => {
            const keyNum = String(Object.keys(udata).length);
            if (!!currentNum) {
              setUdata((prev) => {
                return { ...prev, [currentNum]: currentEncrypted.current };
              });
            }
            setCurrentNum(keyNum);
            setEncrypted(udata[keyNum]);
            setUdata((prev) => {
              return { ...prev, [keyNum]: "" };
            });
          }}
        >
          + New Entry
        </button>
      </li>
    </ul>
  );
}

function Write() {
  const { syncTrigger, setSyncTrigger } = useContext(SyncTrigger);
  const { udata } = useContext(Udata);
  const [invalid, setInvalid] = useState(false);
  async function getToken(e) {
    const data = new FormData(e.target);
    const uid = utils.tth16(data.get("username"));
    const secretTalks = await Promise.all([
      $.ajax({
        url: "/void/regilo",
        method: "GET",
        headers: {
          Authorization: uid[1],
        },
        data: {
          intent: "write",
        },
      }),
      argon2.hash({
        pass: data.get("password"),
        salt: uid[0],
        time: 5,
        mem: 65536,
        parallelism: 1,
        hashLen: 24,
        type: argon2.ArgonType.Argon2id,
      }),
    ]);
    console.log("Regilo Passed!");
    const salt = utils.fromB64(secretTalks[0].salt);
    const nonce = utils.fromB64(secretTalks[0].nonce);
    const apikeyh = await argon2.hash({
      pass: secretTalks[1].hash,
      salt: salt,
      time: 5,
      mem: 65536,
      parallelism: 1,
      hashLen: 32,
      type: argon2.ArgonType.Argon2id,
    });
    const hmac = utils.mac(apikeyh.hash, nonce);
    const hmacB64 = utils.toB64(hmac);
    const loginResponse = await $.ajax({
      url: "/void/gin",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        hmac: hmacB64,
        nonce: secretTalks[0].nonce,
      }),
    });
    const token = loginResponse.token;
    sessionStorage.setItem("write", token);
  }
  async function submit(e) {
    setSyncTrigger(true);
    await getToken(e);
    const packageSent = JSON.stringify(udata);
    await $.ajax({
      url: "/void/write",
      method: "POST",
      contentType: "application/json",
      headers: {
        Authorization: sessionStorage.write,
      },
      data: JSON.stringify({ udata: packageSent }),
    });
    if (invalid) {
      setInvalid(false);
    }
    setSyncTrigger(false);
  }
  return (
    <div id="writeDiv">
      <form
        id="write"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await submit(e);
          } catch (err) {
            if (err.status === 402 || err.status === 401) {
              setInvalid(true);
            } else if (err.status === 500) {
              alert(
                "The server might be facing some issues. It is recommended to save your changes locally until this is resolved.",
              );
            } else {
              console.log(err);
            }
            setSyncTrigger(false);
          }
        }}
      >
        <input
          id="uid"
          max="254"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          required
          name="username"
          placeholder="Username"
        />
        <input
          id="pwd"
          name="password"
          type="password"
          placeholder="Password"
        />
        <button disabled={!!syncTrigger} id="sync" type="submit">
          <span> Sync to Server </span>
        </button>
      </form>
      <h4 className={invalid ? "" : "hidden"}>Invalid Credentials!</h4>
    </div>
  );
}

function App({ mainObj }) {
  const [udata, setUdata] = useState(mainObj);
  return (
    <Udata.Provider value={{ udata, setUdata }}>
      <div id="app">
        <SyncTriggerProvider>
          <CurrentKeyProvider>
            <EncKeyInput keyHash={mainObj.enckeyh} />
            <KeyError />
            <div id="mainBoard">
              <EncTextProvider>
                <Editor />
                <EntryList />
              </EncTextProvider>
            </div>
          </CurrentKeyProvider>
          <Write />
        </SyncTriggerProvider>
      </div>
    </Udata.Provider>
  );
}

export default App;
