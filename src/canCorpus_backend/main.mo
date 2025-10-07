import LLM "mo:llm";
import Array "mo:base/Array";
import Error "mo:base/Error";
import Text "mo:base/Text";
import Principal "mo:base/Principal";

persistent actor {

  var adminPrincipal :?Principal = null;

  var systemMessages : [Text] = [
    "You are a customer support AI agent helper. Your name is canCorpus, designed to assist with customer inquiries."
  ];

// Admin functions
  public shared({ caller }) func addEntry(content : Text) : async Bool {
    //First-time login: assign caller as admin
    if(adminPrincipal==null){
      adminPrincipal:= ?caller;
    };

    if (adminPrincipal != ?caller ) {
      throw Error.reject("Unauthorized: Only admin can add entries");
    };
    systemMessages := Array.append(systemMessages, [content]);
    true;
  };

  public query func listEntries() : async [Text] {
    systemMessages;
  };

  public shared ({ caller }) func clearEntries() : async Bool {
    if (adminPrincipal != ?caller ) {
      throw Error.reject("Unauthorized: Only admin can add entries");
    };
    systemMessages := [];
    true;
  };

  public shared ({ caller }) func deleteEntry(index : Nat) : async Bool {
    if (adminPrincipal != ?caller ) {
      throw Error.reject("Unauthorized: Only admin can delete entries");
    };

    let len = systemMessages.size();
    if (index >= len) {
      return false;
    };

    var newArr : [Text] = [];
    var i : Nat = 0;
    while (i < len) {
      if (i != index) {
        // append existing entry
        newArr := Array.append(newArr, [systemMessages[i]]);
      };
      i += 1;
    };

    systemMessages := newArr;
    true;
  };

  public shared ({ caller }) func editEntry(index : Nat, content : Text) : async Bool {
    if (adminPrincipal != ?caller ) {
      throw Error.reject("Unauthorized: Only admin can edit entries");
    };

    let len = systemMessages.size();
    if (index >= len) {
      return false;
    };

    var newArr : [Text] = [];
    var i : Nat = 0;
    while (i < len) {
      if (i == index) {
        newArr := Array.append(newArr, [content]);
      } else {
        newArr := Array.append(newArr, [systemMessages[i]]);
      };
      i += 1;
    };

    systemMessages := newArr;
    true;
  };


  /// Public user query. This will chunk the stored system messages when there
  /// are too many to send at once. It asks the LLM for each chunk:
  /// "Do You have the answer for <question>? if yes answer and if not then say <apology>"
  /// If any chunk returns a non-apology answer, that answer is returned. Otherwise
  /// a standard apology is returned.
  public func ask(question : Text) : async Text {
    let MAX_PER_CHUNK = 12; // conservative limit to avoid exceeding message limits
    let apology = "Sorry i have no information for that, please contact our customer support for that";

    let total = systemMessages.size();
    var start = 0;

    // iterate chunks of system messages
    while (start < total) {
      let end = if (start + MAX_PER_CHUNK < total) start + MAX_PER_CHUNK else total;

      var messages : [LLM.ChatMessage] = [];

      // add system messages for this chunk
      var i = start;
      while (i < end) {
        let entry = systemMessages[i];
        messages := Array.append(messages, [#system_({ content = entry })]);
        i += 1;
      };

      // user prompt that instructs the model to answer only if it has the answer
      let userPrompt = "Do You have the answer for \"" # question # "\"? if yes answer and if not then say \"" # apology # "\"";
      messages := Array.append(messages, [#user({ content = userPrompt })]);

      // send to LLM
  // Build and send chat request. 
  let response = await LLM.chat(#Llama3_1_8B).withMessages(messages).send();

      switch (response.message.content) {
        case (?text) {
          // if model returns the apology, continue to next chunk
          if (Text.contains(text, #text(apology))) {
            // try next chunk
          } else {
            return text;
          };
        };
        case null {
          // treat as no answer and continue
        };
      };

      start := end;
    };

    // nothing found in any chunk
    apology;
  };
};
