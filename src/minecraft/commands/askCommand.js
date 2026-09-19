const minecraftCommand = require("../../contracts/minecraftCommand.js");

let lastQuestionTime = 0;

const answers = [
  "apple", "banana", "orange", "grape", "lemon", "lime", "peach", "pear", "plum", "cherry",
  "melon", "berry", "mango", "papaya", "kiwi", "coconut", "avocado", "tomato", "potato", "carrot",
  "onion", "garlic", "pepper", "pumpkin", "radish", "turnip", "celery", "spinach", "lettuce", "cabbage",
  "broccoli", "bean", "pea", "corn", "rice", "wheat", "oat", "bread", "cheese", "butter",
  "milk", "cream", "sugar", "honey", "salt", "coffee", "tea", "water", "juice", "soda",
  "river", "ocean", "lake", "pond", "stream", "waterfall", "mountain", "hill", "valley", "forest",
  "desert", "island", "beach", "shore", "cliff", "cave", "field", "meadow", "garden", "park",
  "tree", "flower", "grass", "leaf", "branch", "root", "stone", "rock", "sand", "mud",
  "cloud", "rain", "snow", "storm", "thunder", "lightning", "wind", "breeze", "fog", "mist",
  "sun", "moon", "star", "planet", "comet", "galaxy", "space", "sky", "earth", "fire",
  "house", "home", "room", "door", "window", "wall", "floor", "ceiling", "roof", "stairs",
  "chair", "table", "desk", "bed", "couch", "shelf", "drawer", "closet", "mirror", "lamp",
  "clock", "phone", "computer", "keyboard", "mouse", "screen", "camera", "radio", "speaker", "television",
  "book", "paper", "pencil", "pen", "eraser", "notebook", "folder", "letter", "picture", "photo",
  "bag", "box", "bottle", "cup", "plate", "fork", "spoon", "knife", "hammer", "brush",
  "car", "truck", "bus", "train", "plane", "boat", "ship", "bike", "bicycle", "motorcycle",
  "wheel", "engine", "road", "street", "highway", "bridge", "tunnel", "station", "airport", "garage",
  "driver", "passenger", "ticket", "map", "route", "signal", "light", "sign", "fuel", "motor",
  "speed", "race", "track", "travel", "journey", "trip", "vacation", "holiday", "camp", "tent",
  "backpack", "compass", "north", "south", "east", "west", "direction", "distance", "mile", "meter",
  "dog", "cat", "bird", "fish", "horse", "cow", "pig", "sheep", "goat", "chicken",
  "duck", "goose", "rabbit", "mouse", "rat", "fox", "wolf", "bear", "deer", "moose",
  "lion", "tiger", "leopard", "zebra", "giraffe", "monkey", "gorilla", "panda", "elephant", "rhino",
  "snake", "lizard", "turtle", "frog", "shark", "whale", "dolphin", "octopus", "crab", "lobster",
  "bee", "ant", "spider", "butterfly", "dragonfly", "beetle", "worm", "fly", "bug", "insect",
  "red", "blue", "green", "yellow", "orange", "purple", "pink", "black", "white", "brown",
  "gray", "silver", "gold", "bright", "dark", "light", "soft", "hard", "rough", "smooth",
  "big", "small", "large", "tiny", "tall", "short", "wide", "narrow", "long", "deep",
  "fast", "slow", "hot", "cold", "warm", "cool", "old", "young", "new", "ancient",
  "clean", "dirty", "empty", "full", "heavy", "thin", "thick", "strong", "weak", "loud",
  "happy", "sad", "angry", "calm", "excited", "bored", "tired", "awake", "hungry", "thirsty",
  "afraid", "brave", "kind", "mean", "funny", "serious", "strange", "normal", "weird", "quiet",
  "proud", "shy", "smart", "silly", "clever", "curious", "confused", "ready", "busy", "free",
  "good", "bad", "great", "terrible", "perfect", "wrong", "right", "easy", "hard", "simple",
  "complex", "important", "random", "useful", "useless", "possible", "impossible", "real", "fake", "true",
  "run", "walk", "jump", "sit", "stand", "sleep", "wake", "eat", "drink", "cook",
  "read", "write", "draw", "paint", "build", "break", "make", "fix", "open", "close",
  "start", "stop", "begin", "finish", "play", "work", "learn", "teach", "think", "know",
  "see", "look", "watch", "hear", "listen", "speak", "talk", "ask", "answer", "say",
  "find", "lose", "give", "take", "bring", "send", "receive", "buy", "sell", "trade",
  "person", "people", "friend", "family", "parent", "child", "brother", "sister", "teacher", "student",
  "doctor", "nurse", "farmer", "builder", "driver", "pilot", "artist", "writer", "actor", "player",
  "king", "queen", "prince", "princess", "hero", "villain", "captain", "leader", "guard", "soldier",
  "neighbor", "stranger", "customer", "worker", "boss", "owner", "guest", "host", "team", "group",
  "crowd", "class", "school", "college", "university", "company", "office", "store", "shop", "market",
  "game", "score", "level", "player", "enemy", "friend", "boss", "quest", "mission", "battle",
  "sword", "shield", "armor", "helmet", "bow", "arrow", "spear", "staff", "wand", "weapon",
  "coin", "gold", "chest", "key", "door", "castle", "tower", "dungeon", "cave", "village",
  "kingdom", "world", "map", "character", "item", "block", "pixel", "server", "network", "computer",
  "code", "program", "game", "mod", "plugin", "command", "console", "screen", "button", "menu",
  "code", "function", "variable", "object", "array", "string", "number", "boolean", "class", "method",
  "file", "folder", "project", "program", "script", "server", "client", "database", "website", "browser",
  "internet", "network", "router", "address", "port", "packet", "request", "response", "query", "data",
  "error", "bug", "fix", "update", "version", "system", "process", "memory", "storage", "drive",
  "linux", "windows", "apple", "android", "python", "javascript", "java", "rust", "html", "css",
  "morning", "afternoon", "evening", "night", "today", "tomorrow", "yesterday", "week", "month", "year",
  "second", "minute", "hour", "day", "time", "moment", "future", "past", "present", "season",
  "spring", "summer", "autumn", "winter", "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december", "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday", "weekend", "calendar", "date", "birthday", "holiday", "event", "schedule",
  "music", "song", "sound", "voice", "noise", "beat", "rhythm", "guitar", "piano", "drum",
  "movie", "film", "show", "story", "book", "novel", "chapter", "scene", "character", "plot",
  "art", "painting", "drawing", "photo", "picture", "color", "shape", "line", "circle", "square",
  "sport", "football", "soccer", "hockey", "basketball", "baseball", "tennis", "golf", "climb", "swim",
  "run", "jump", "race", "team", "ball", "goal", "score", "win", "lose", "match",
  "idea", "thought", "question", "answer", "reason", "problem", "solution", "choice", "decision", "plan",
  "dream", "hope", "fear", "memory", "secret", "truth", "lie", "fact", "story", "meaning",
  "thing", "stuff", "object", "place", "person", "world", "life", "death", "beginning", "ending",
  "middle", "side", "top", "bottom", "front", "back", "inside", "outside", "center", "edge",
  "point", "line", "area", "space", "time", "way", "part", "piece", "kind", "type",
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "hundred", "thousand", "million", "first", "second", "third", "last", "next", "previous",
  "more", "less", "many", "few", "some", "none", "all", "any", "each", "every",
  "always", "never", "sometimes", "often", "usually", "rarely", "maybe", "perhaps", "probably", "certainly",
  "almost", "already", "again", "still", "just", "only", "also", "even", "very", "really",
  "hello", "goodbye", "thanks", "please", "sorry", "welcome", "yes", "no", "maybe", "okay",
  "sure", "fine", "great", "alright", "whatever", "nothing", "something", "anything", "everything", "nobody",
  "someone", "anyone", "everyone", "here", "there", "where", "when", "why", "how", "what",
  "who", "which", "because", "although", "however", "therefore", "maybe", "perhaps", "indeed", "apparently",
  "obviously", "actually", "basically", "probably", "certainly", "definitely", "possibly", "exactly", "somehow", "anyway",
  "hammer", "wrench", "screwdriver", "drill", "saw", "nail", "screw", "bolt", "wire", "cable",
  "battery", "engine", "machine", "tool", "box", "bucket", "rope", "chain", "hook", "lock",
  "switch", "button", "lever", "handle", "pipe", "valve", "pump", "motor", "gear", "wheel",
  "metal", "wood", "plastic", "glass", "stone", "steel", "iron", "copper", "rubber", "paper",
  "cardboard", "fabric", "leather", "clay", "brick", "concrete", "dust", "sand", "water", "oil",
  "circle", "square", "triangle", "rectangle", "diamond", "star", "heart", "arrow", "point", "corner",
  "center", "edge", "side", "top", "bottom", "left", "right", "middle", "front", "back",
  "inside", "outside", "above", "below", "under", "over", "near", "far", "around", "between",
  "before", "after", "during", "while", "until", "since", "through", "across", "behind", "beside",
  "forward", "backward", "upward", "downward", "forward", "backward", "straight", "round", "flat", "curved",
  "forest", "jungle", "desert", "savanna", "tundra", "swamp", "canyon", "valley", "mountain", "volcano",
  "island", "continent", "country", "city", "town", "village", "street", "road", "bridge", "building",
  "tower", "castle", "palace", "temple", "church", "school", "hospital", "library", "museum", "station",
  "airport", "harbor", "port", "farm", "field", "park", "garden", "yard", "house", "home",
  "energy", "power", "force", "speed", "gravity", "heat", "light", "sound", "motion", "energy",
  "electricity", "current", "voltage", "charge", "magnet", "metal", "atom", "molecule", "cell", "science",
  "physics", "chemistry", "biology", "math", "number", "formula", "theory", "experiment", "result", "test",
  "question", "answer", "research", "study", "knowledge", "information", "fact", "evidence", "data", "proof",
  "random", "strange", "weird", "normal", "interesting", "boring", "funny", "serious", "secret", "mystery",
  "magic", "future", "past", "present", "unknown", "known", "hidden", "lost", "found", "broken",
  "fixed", "finished", "started", "stopped", "open", "closed", "locked", "unlocked", "empty", "full",
  "alive", "dead", "real", "fake", "true", "false", "correct", "incorrect", "right", "wrong"
];

class AskCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "ask";
    this.aliases = ["ai", "askai"];
    this.description = "Ask the AI a question.";
    this.options = [
      {
        name: "question",
        description: "The question you want to ask.",
        required: true
      }
    ];
  }

  /**
   * @param {string} player
   * @param {string} message
   */
  async onCommand(player, message) {
    const args = this.getArgs(message);

    if (args.length === 0) {
      this.send("[ERROR] Please provide a question.");
      return;
    }

    const cooldown = 60 * 1000;
    const currentTime = Date.now();

    if (currentTime - lastQuestionTime < cooldown) {
      const secondsLeft = Math.ceil(
        (cooldown - (currentTime - lastQuestionTime)) / 1000
      );

      this.send(
        "✦ Wait " + secondsLeft + "s before asking again."
      );

      return;
    }

    lastQuestionTime = currentTime;

    this.send("Input received.");

    await new Promise(resolve => setTimeout(resolve, 5000));

    const answer = answers[
      Math.floor(Math.random() * answers.length)
    ];

    this.send(answer);
  }
}

module.exports = AskCommand;