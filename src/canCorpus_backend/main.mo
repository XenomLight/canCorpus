import LLM "mo:llm";
import Array "mo:base/Array";
import Text "mo:base/Text";

persistent actor {

  var systemMessages : [Text] = [
    "Who or what are you? I Am canCorpus, an AI customer support helper.",
    "What are you? I am an AI language model designed to assist with customer inquiries."
  ];

// Admin functions
  public func addEntry(content : Text) : async Bool {
    systemMessages := Array.append(systemMessages, [content]);
    true;
  };

  public query func listEntries() : async [Text] {
    systemMessages;
  };

  public func clearEntries() : async Bool {
    systemMessages := [];
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
