export const personalInfo = {
  name: "Samuel Chao",
  chineseName: "趙啟翔",
  github: "BeanSamuel",
  email: "samuelchao921221@gmail.com",
  website: "https://beansamuel.github.io",
  role: "NLP Researcher | Backend Developer",
};

// Newest first — Experience.jsx renders this order as-is.
export const education = [
  {
    institution: "國立臺灣大學 (National Taiwan University)",
    department: "電機工程學研究所 (Graduate Institute of Electrical Engineering)",
    period: "Sept 2026 – Present",
    details: "M.S. student"
  },
  {
    institution: "國立中央大學 (National Central University)",
    department: "資訊工程學系 (Computer Science and Information Engineering)",
    period: "Sept 2022 – June 2026",
    details: "GPA 4.09 / 4.3  ·  Dept. Rank 35 / 113  ·  CPE 6 / 7 Problems Solved  ·  1132 書卷獎"
  },
  {
    institution: "臺北市私立靜心高級中學 (Jing Shin High School)",
    department: "普通科 (General Studies)",
    period: "Sept 2019 – June 2022",
    details: "高中即參與 NLP 研究（指導：蔡宗翰教授）  ·  發表 ROCLING 2021 / TAAI 2021 對話行為嵌入研究"
  }
];

export const experience = [
  {
    title: "Programming Instructor",
    company: "Telearn",
    period: "June 2022 – Present",
    description: [
      "Teaching programming from elementary through high school level — Scratch, Python, and C/C++",
      "Coaching APCS preparation and algorithmic problem solving: data structures, algorithms, and contest-style practice",
      "Mentoring students one-on-one for programming contests and ITS certification"
    ]
  },
  {
    title: "Research Intern — 資訊科技創新研究中心 (資創中心 / CITI)",
    company: "Academia Sinica",
    period: "July 2025 – Aug 2026",
    description: [
      "Investigated cross-modal alignments of large pre-trained models for representation and semantic enhancement",
      "Researched methods to measure semantic understanding across modalities in LLMs",
      "Co-authored paper: \"Do Latent Space Similarities Reflect Semantic Relatedness?\" — presented as a poster at TAAI 2025"
    ]
  },
  {
    title: "Backend & QA Developer",
    company: "EDU-TAIDE",
    period: "July 2024 – July 2025",
    description: [
      "Led overall system architecture design for the EDU-TAIDE UI platform",
      "Coordinated integration across frontend, backend, and model inference layers",
      "Developed automated testing pipelines and backend APIs for the AI education service"
    ]
  }
];

export const publications = [
  {
    title: "Ensemble-Based Multi-Specialty Retrieval: Integrating Diverse Similarity Metrics for Enhanced Question Answering",
    authors: "Chao, C.-H., Chang, H.-F., & Teng, P.-Y.",
    year: 2025,
    venue: "NTCIR-18 Conference on Evaluation of Information Access Technologies: AI CUP Special Session",
    link: "https://research.nii.ac.jp/ntcir/workshop/OnlineProceedings18/AI_CUP/02-AICUP-AICUP-ChaoC.pdf"
  },
  {
    title: "Do Latent Space Similarities Reflect Semantic Relatedness? Cross-Modal Alignments of Large Pre-Trained Models",
    authors: "Chao, C.-H., Zezario, R. E., & Tsao, Y.",
    year: 2025,
    venue: "TAAI 2025 — Poster Session"
  },
  {
    title: "BoostTrack-enabled YOLOv5-nano Edge Vision for Enhanced Situational Awareness in Fire Scenarios Within Smart Living Environments",
    authors: "Chao, C.-H., Lin, J. C., & Wang, Y.-C.",
    year: 2025,
    venue: "IEEE Artificial Intelligence and Smart Technology Applications Symposium (AISTA 2025)"
  },
  {
    title: "Improve Chit-chat and QA Sentence Classification in User Messages of Dialogue System Using Dialogue Act Embedding",
    authors: "Chao, C.-H., Hou, X.-J., & Chiu, Y.-C.",
    year: 2021,
    venue: "ROCLING 2021 — The 33rd Conference on Computational Linguistics and Speech Processing",
    link: "https://aclanthology.org/2021.rocling-1.19/"
  },
  {
    title: "Improve Chit-chat and QA Sentence Classification in User Messages of Dialogue System Using Dialogue Act",
    authors: "Chao, C.-H., Hou, X.-J., & Chiu, Y.-C.",
    year: 2021,
    venue: "TAAI 2021 — Domestic Track"
  }
];

export const awards = [
  { title: "雙北程式設計節 — 城市儀表板大黑客松 第三名 (3rd Place)", year: "2026" },
  { title: "ICPC Asia Taichung Regional Programming Contest — 銅牌 (Bronze Medal)", year: "2025" },
  { title: "ICPC Asia Taiwan Online Programming Contest — 銀牌 (Silver Medal)", year: "2025" },
  { title: "國立中央大學 1132 學期書卷獎 (Academic Excellence Award)", year: "2025" },
  { title: "113學年度資電院大學部專題競賽 佳作", year: "2025" },
  { title: "113學年度資工系大學部專題實驗競賽 佳作、人氣獎", year: "2025" },
  { title: "AICUP 2024 玉山人工智慧挑戰賽 RAG × LLM 金融問答 — TOP 4.7% (487 teams)", year: "2024" },
  { title: "未來網路應用創意競賽 銅牌 (Bronze Medal)", year: "2024" },
  { title: "全國大專電腦軟體設計競賽 佳作", year: "2023" },
  { title: "VEX 機器人競賽 全國技能挑戰賽 第 9 名", year: "2020" }
];

// Contest results shown on the Competitive Programming page, alongside the
// live practice stats pulled from the cpp_practice repo.
export const competitiveHighlights = [
  {
    title: "ICPC Asia Taiwan Online Programming Contest",
    result: "銀牌 Silver Medal",
    year: "2025",
    color: "var(--accent-primary)"
  },
  {
    title: "ICPC Asia Taichung Regional Programming Contest",
    result: "銅牌 Bronze Medal",
    year: "2025",
    color: "var(--accent-secondary)"
  },
  {
    title: "CPE 大學程式能力檢定",
    result: "6 / 7 Problems Solved",
    year: "2024",
    color: "var(--accent-tertiary)"
  },
  {
    title: "全國大專電腦軟體設計競賽",
    result: "佳作 Honorable Mention",
    year: "2023",
    color: "var(--accent-primary)"
  }
];

export const cppPracticeRepo = "BeanSamuel/cpp_practice";

export const projects = [
  {
    name: "基於多專業嵌入模型之裁判書檢索方法",
    tag: "NLP / Information Retrieval",
    description: "NTCIR-18 task: multi-specialty embedding ensemble for legal judgment document retrieval and multi-turn QA. Awarded 佳作 in NCU departmental competition."
  },
  {
    name: "CARDS: Catching AI Revealing Deceptive Strategies",
    tag: "NLP / Game AI",
    description: "Competitive deception-detection board game powered by LLMs to identify AI-generated versus human text in real-time game scenarios."
  },
  {
    name: "Pretrained FIN-LLAMA3",
    tag: "NLP / Finance",
    description: "Domain-adaptive fine-tuning of LLaMA 3 on financial corpora for RAG-based Q&A, sentiment analysis, and report summarization."
  },
  {
    name: "Smart Market Information Analysis Assistant",
    tag: "NLP / RAG",
    description: "Intelligent market analysis assistant leveraging retrieval-augmented generation (RAG) and LLMs to surface actionable financial insights from live data."
  },
  {
    name: "HeyBot: Natural Language Extension for LineBot",
    tag: "NLP / Chatbot",
    description: "LINE chatbot enhanced with intent classification and contextual NLP for natural, multi-turn conversations across diverse user queries."
  },
  {
    name: "ARF! ARF! Who's My Owner",
    tag: "Computer Vision / Robotics",
    description: "Robot dog that identifies its owner via YOLOv5-based person recognition and BoostTrack multi-object tracking in real time."
  },
  {
    name: "Enhancing Voice Authenticity in S2ST System",
    tag: "Speech Processing",
    description: "Improving speech-to-speech translation quality with speaker identity preservation and voice authenticity enhancement techniques."
  }
];

// Public writing. `views` is maintained by hand: HackMD has no stats API, but
// https://hackmd.io/<note-id>/info returns a public JSON blob with `viewcount`
// — read it from there and round down when refreshing these numbers.
export const writings = [
  {
    title: "Nano5 使用筆記",
    subtitle: "NCHC Nano5 HPC Field Notes",
    platform: "HackMD",
    url: "https://hackmd.io/mlwhc95MS_iJ-g3-tIZMEQ?view",
    description:
      "在國網中心 Nano5 叢集上跑實驗的操作筆記：從 2FA 登入、conda 環境、sbatch 樣板到 PyTorch/CUDA 版本排錯，把踩過的坑寫成可以直接照抄的流程。",
    topics: [
      "登入與 2FA", "登入節點鐵則", "Conda 環境", "sbatch 樣板",
      "Slurm 常用指令", "SFTP 傳檔", "Git SSH 設定",
      "Hugging Face 登入", "PyTorch / CUDA 相容性", "錯誤排查表"
    ]
  },
  {
    title: "經典邏輯題",
    subtitle: "Classic Logic Puzzles",
    platform: "HackMD",
    url: "https://hackmd.io/@BeanSamuel/S1-vxjfXp",
    views: "24,000+",
    description:
      "12 道經典邏輯謎題的完整拆解，從海盜分金幣、囚犯帽子到生死抉擇。每題先給題目，答案收在 spoiler 裡，讀者可以先想過再展開推理過程。",
    topics: [
      "海盜分金幣", "繩子燃燒問題", "賽馬名次", "驗證牌背",
      "帽子問題", "乒乓球問題", "時鐘切割", "生日日期",
      "木塊並排", "數列排列問題", "分金條", "生死抉擇"
    ]
  }
];

export const abilities = [
  {
    category: "AI & NLP Research",
    items: [
      "Large Language Models (LLM)",
      "Retrieval-Augmented Generation (RAG)",
      "Cross-Modal Representation Learning",
      "Computer Vision (YOLOv5 / YOLO)",
      "Speech Processing (S2ST)"
    ],
    color: "var(--accent-primary)"
  },
  {
    category: "Software Development",
    items: [
      "Python / Node.js / C++",
      "Backend API Architecture",
      "System Integration & Testing",
      "React / Vite (Frontend)",
      "Git & CI/CD Workflows"
    ],
    color: "var(--accent-secondary)"
  },
  {
    category: "Algorithms & Competitive",
    items: [
      "Competitive Programming (ICPC Regionals)",
      "Data Structures & Algorithm Design",
      "CPE: 6 / 7 Problems Solved",
      "Dynamic Programming & Graph Theory"
    ],
    color: "var(--accent-tertiary)"
  }
];
