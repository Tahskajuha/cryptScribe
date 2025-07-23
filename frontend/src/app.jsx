import React from "react";
import $ from "jquery";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import "/styles/buttons.css";
import "/styles/app.css";
import utils from "/src/utils.js";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";

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
    extensions: [Document, Paragraph, Text],
    content: "",
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
      editor.commands.setContent(
        enckey
          ? utils.decrypt(currentEncrypted.current, enckey)
          : currentEncrypted.current,
      );
    }
  }, [enckey, currentNum]);
  useEffect(() => {
    currentEncrypted.current = encrypted;
    setPending(currentEncrypted.current);
    if (editor) {
      editor.commands.setContent(
        enckey
          ? utils.decrypt(currentEncrypted.current, enckey)
          : currentEncrypted.current,
      );
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
    setSyncTrigger(false);
  }
  return (
    <form
      id="write"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await submit(e);
        } catch (err) {
          console.log(err);
        }
      }}
    >
      <input id="uid" name="username" placeholder="Username" />
      <input id="pwd" name="password" type="password" placeholder="Password" />
      <button disabled={!!syncTrigger} id="sync" type="submit">
        <span> Sync to Server </span>
      </button>
    </form>
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
