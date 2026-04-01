export const personalInfo = {
  name: "Samuel Chao",
  chineseName: "趙啟翔",
  github: "BeanSamuel",
  email: "samuelchao921221@gmail.com",
  website: "https://beansamuel.github.io",
  role: "NLP & AI Researcher | Backend Developer | Robotics Vision",
};

export const education = [
  {
    institution: "國立中央大學 (National Central University)",
    department: "資訊工程學系 (Computer Science and Information Engineering)",
    period: "Sept 2022 – Present",
    details: "Focusing on Software Engineering, Artificial Intelligence, and Algorithms."
  }
];

export const experience = [
  {
    title: "中央研究院資訊科技創新研究中心實習生",
    company: "Academia Sinica",
    period: "July 2025 – Present",
    description: [
      "專注於研究大型語言模型（LLM）潛在空間之間的關係",
      "目前研究跨模態模型中測量語意理解的方法"
    ]
  },
  {
    title: "EDU-TAIDE 後端與測試開發人員",
    company: "EDU-TAIDE",
    period: "July 2024 – July 2025",
    description: [
      "主導 EDU-TAIDE UI 平台的整體系統架構設計",
      "協調前端、後端與模型推論層的設計與整合"
    ]
  }
];

export const publications = [
  {
    title: "Ensemble-Based Multi-Specialty Retrieval: Integrating Diverse Similarity Metrics for Enhanced Question Answering.",
    authors: "Chao, C.-H., Chang, H.-F., & Teng, P.-Y.",
    year: 2025,
    venue: "NTCIR-18 Conference on Evaluation of Information Access Technologies: AI CUP Special Session",
    link: "https://research.nii.ac.jp/ntcir/workshop/OnlineProceedings18/AI_CUP/02-AICUP-AICUP-ChaoC.pdf"
  },
  {
    title: "BoostTrack-enabled YOLOv5-nano edge vision for enhanced situational awareness in fire scenarios within smart living environments for human and animal safety.",
    authors: "Chao, C.-H., Lin, J. C., & Wang, Y.-C.",
    year: 2025,
    venue: "Artificial Intelligence and Smart Technology Applications Symposium (AISTA 2025)"
  },
  {
    title: "Do latent space similarities reflect semantic relatedness?",
    authors: "Chao, C.-H., Zezario, R. E., & Tsao, Y.",
    year: 2025,
    venue: "Unpublished manuscript. NCU & Academia Sinica"
  },
  {
    title: "Improve chit-chat and QA sentence classification in user messages of dialogue system using dialogue act embedding.",
    authors: "Chao, C. H., Hou, X. J., & Chiu, Y. C.",
    year: 2021,
    venue: "ROCLING 2021",
    link: "https://aclanthology.org/2021.rocling-1.19/"
  },
  {
    title: "Improve Chit-chat and QA Sentence Classification in User Messages of Dialogue System using Dialogue Act.",
    authors: "Chao, C.-H., Hou, X.-J., & Chiu, Y.-C.",
    year: 2021,
    venue: "TAAI 2021, Domestic Track"
  }
];

export const awards = [
  { title: "The 2025 ICPC Asia Taichung Regional Programming Contest 銅牌", year: "2025" },
  { title: "The 2025 ICPC Asia Taiwan Online Programming Contest 銀牌", year: "2025" },
  { title: "AICUP 2024 玉山人工智慧挑戰賽－RAG與LLM在金融問答的應用 TOP 4.7%(共 487 隊)", year: "2024" },
  { title: "未來網路應用創意競賽 銅牌", year: "2024" },
  { title: "全國大專電腦軟體設計競賽 佳作", year: "2023" },
  { title: "VEX 機器人競賽 全國技能挑戰賽第 9 名", year: "2020" }
];

export const projects = [
  { name: "基於多專業嵌入模型之裁判書檢索方法", tag: "Natural Language Processing" },
  { name: "CARDS: Catching AI Revealing Deceptive Strategies", tag: "Natural Language Processing" },
  { name: "Pretrained FIN-LLAMA3", tag: "Natural Language Processing" },
  { name: "Smart Market Information Analysis Assistant", tag: "Natural Language Processing" },
  { name: "HeyBot: Natural Language Extension for LineBot", tag: "Natural Language Processing" },
  { name: "ARF! ARF! Who’s My Owner", tag: "Robot Vision" },
  { name: "Enhancing Voice Authenticity in S2ST System", tag: "Speech Processing" }
];

// Re-structured abilities/skills matrix
export const abilities = [
  {
    category: "AI & Machine Learning",
    items: ["Natural Language Processing (NLP)", "Large Language Models (LLM)", "RAG Systems", "Computer Vision (YOLO)"],
    color: "var(--accent-primary)" // Cyan
  },
  {
    category: "Backend & Systems",
    items: ["Node.js", "Python", "API Architecture", "System Integration", "Testing Automation"],
    color: "var(--accent-secondary)" // Pink/Magenta
  },
  {
    category: "Algorithms & Core",
    items: ["Competitive Programming (ICPC Silver)", "Data Structures", "Algorithm Design", "Pattern Recognition"],
    color: "var(--accent-tertiary)" // Blue glow
  }
];
