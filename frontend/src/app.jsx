import React from "react";
import { createContext, useContext, useState } from "react";
import ReactDOM from "react-dom/client";
import "/styles/buttons.css";
import "/styles/app.css";
import utils from "/src/utils.js";

const KeyCheck = createContext();
const EntryNum = createContext();

function CurrentKeyProvider({ children }) {
  const [enckey, setEnckey] = useState("");
  return (
    <KeyCheck.Provider value={{ enckey, setEnckey }}>
      {children}
    </KeyCheck.Provider>
  );
}

function EntryNumProvider({ children }) {
  const [entrynum, setentrynum] = useState(null);
  return (
    <EntryNum.Provider value={{ entrynum, setentrynum }}>
      {children}
    </EntryNum.Provider>
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

function Editor() {
  const { enckey } = useContext(KeyCheck);
  const [encrypted, setEncrypted] = useState("");
  return (
    <textarea
      id="editor"
      disabled={enckey ? false : true}
      placeholder="Select an entry or create a new one!"
      a
      onChange={(e) => {
        const newText = e.target.value;
        if (enckey) {
          setEncrypted(utils.encrypt(newText, enckey));
        }
      }}
      value={enckey ? utils.decrypt(encrypted, enckey) : encrypted}
    ></textarea>
  );
}

function EntryList() {
  return (
    <ul id="entrylist">
      <li>
        <button>+ New Entry</button>
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

function App({ udata }) {
  return (
    <div id="app">
      <CurrentKeyProvider>
        <EncKeyInput keyHash={udata.enckeyh} />
        <KeyError />
        <div id="mainBoard">
          <EntryNumProvider>
            <Editor />
            <EntryList />
          </EntryNumProvider>
        </div>
      </CurrentKeyProvider>
      <Write />
    </div>
  );
}

export default App;
