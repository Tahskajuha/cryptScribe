import React from "react";
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
  return (
    <form id="write">
      <input id="uid" placeholder="Username" />
      <input id="pwd" type="password" placeholder="Password" />
      <button id="sync">
        <span> Sync </span>
      </button>
    </form>
  );
}

function App({ mainObj }) {
  const [udata, setUdata] = useState(mainObj);
  return (
    <Udata.Provider value={{ udata, setUdata }}>
      <div id="app">
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
      </div>
    </Udata.Provider>
  );
}

export default App;
