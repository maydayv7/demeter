import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  Cpu,
  Droplets,
  Eye,
  FlaskConical,
  HandMetal,
  HelpCircle,
  Info,
  Leaf,
  Sparkles,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";
import { useT } from "../hooks/useTranslation";
import { PrimaryButton } from "../components/ui";

// Data

const TERMS = [
  {
    id: "ph",
    icon: FlaskConical,
    color: "var(--blue)",
    labelKey: "help_term_ph",
    shortKey: "help_term_ph_short",
    simpleKey: "help_term_ph_simple",
    detailKey: "help_term_ph_detail",
    rangeKey: "help_term_ph_range",
    lowKey: "help_term_ph_low",
    highKey: "help_term_ph_high",
    aiActionKey: "help_term_ph_ai",
    manualKey: "help_term_ph_manual",
    agriKey: "help_term_ph_agri",
  },
  {
    id: "ec",
    icon: Zap,
    color: "var(--amber)",
    labelKey: "help_term_ec",
    shortKey: "help_term_ec_short",
    simpleKey: "help_term_ec_simple",
    detailKey: "help_term_ec_detail",
    rangeKey: "help_term_ec_range",
    lowKey: "help_term_ec_low",
    highKey: "help_term_ec_high",
    aiActionKey: "help_term_ec_ai",
    manualKey: "help_term_ec_manual",
    agriKey: "help_term_ec_agri",
  },
  {
    id: "humidity",
    icon: Droplets,
    color: "var(--blue)",
    labelKey: "help_term_humidity",
    shortKey: "help_term_humidity_short",
    simpleKey: "help_term_humidity_simple",
    detailKey: "help_term_humidity_detail",
    rangeKey: "help_term_humidity_range",
    lowKey: "help_term_humidity_low",
    highKey: "help_term_humidity_high",
    aiActionKey: "help_term_humidity_ai",
    manualKey: "help_term_humidity_manual",
    agriKey: "help_term_humidity_agri",
  },
  {
    id: "temp",
    icon: Thermometer,
    color: "var(--red)",
    labelKey: "help_term_temp",
    shortKey: "help_term_temp_short",
    simpleKey: "help_term_temp_simple",
    detailKey: "help_term_temp_detail",
    rangeKey: "help_term_temp_range",
    lowKey: "help_term_temp_low",
    highKey: "help_term_temp_high",
    aiActionKey: "help_term_temp_ai",
    manualKey: "help_term_temp_manual",
    agriKey: "help_term_temp_agri",
  },
];

const AI_AGENTS = [
  {
    id: "fetch",
    icon: Eye,
    color: "var(--blue)",
    nameKey: "help_agent_fetch_name",
    roleKey: "help_agent_fetch_role",
    detailKey: "help_agent_fetch_detail",
  },
  {
    id: "judge",
    icon: BarChart3,
    color: "var(--amber)",
    nameKey: "help_agent_judge_name",
    roleKey: "help_agent_judge_role",
    detailKey: "help_agent_judge_detail",
  },
  {
    id: "strategy",
    icon: Cpu,
    color: "var(--green)",
    nameKey: "help_agent_strategy_name",
    roleKey: "help_agent_strategy_role",
    detailKey: "help_agent_strategy_detail",
  },
  {
    id: "research",
    icon: BookOpen,
    color: "var(--blue)",
    nameKey: "help_agent_research_name",
    roleKey: "help_agent_research_role",
    detailKey: "help_agent_research_detail",
  },
  {
    id: "execute",
    icon: Bot,
    color: "var(--green)",
    nameKey: "help_agent_execute_name",
    roleKey: "help_agent_execute_role",
    detailKey: "help_agent_execute_detail",
  },
  {
    id: "explainer",
    icon: HelpCircle,
    color: "var(--amber)",
    nameKey: "help_agent_explainer_name",
    roleKey: "help_agent_explainer_role",
    detailKey: "help_agent_explainer_detail",
  },
];

const STAGES = [
  {
    id: "seedling",
    emoji: "🌱",
    nameKey: "help_stage_seedling",
    descKey: "help_stage_seedling_desc",
    tipsKey: "help_stage_seedling_tips",
  },
  {
    id: "vegetative",
    emoji: "🌿",
    nameKey: "help_stage_vegetative",
    descKey: "help_stage_vegetative_desc",
    tipsKey: "help_stage_vegetative_tips",
  },
  {
    id: "flowering",
    emoji: "🌸",
    nameKey: "help_stage_flowering",
    descKey: "help_stage_flowering_desc",
    tipsKey: "help_stage_flowering_tips",
  },
  {
    id: "fruiting",
    emoji: "🍅",
    nameKey: "help_stage_fruiting",
    descKey: "help_stage_fruiting_desc",
    tipsKey: "help_stage_fruiting_tips",
  },
];

const MANUAL_SCENARIOS = [
  {
    id: "disease",
    icon: AlertTriangle,
    color: "var(--red)",
    titleKey: "help_manual_disease_title",
    descKey: "help_manual_disease_desc",
    actionKey: "help_manual_disease_action",
  },
  {
    id: "equipment",
    icon: Cpu,
    color: "var(--amber)",
    titleKey: "help_manual_equip_title",
    descKey: "help_manual_equip_desc",
    actionKey: "help_manual_equip_action",
  },
  {
    id: "harvest",
    icon: Leaf,
    color: "var(--green)",
    titleKey: "help_manual_harvest_title",
    descKey: "help_manual_harvest_desc",
    actionKey: "help_manual_harvest_action",
  },
  {
    id: "extreme",
    icon: Wind,
    color: "var(--red)",
    titleKey: "help_manual_extreme_title",
    descKey: "help_manual_extreme_desc",
    actionKey: "help_manual_extreme_action",
  },
];

// Translations

const HELP_EN = {
  help_title: "Help & Glossary",
  help_subtitle: "Everything you need to know - explained simply",
  help_section_terms: "📊 Sensor Terms Explained",
  help_section_agents: "🤖 How AI Works for You",
  help_section_stages: "🌱 Growth Stages",
  help_section_manual: "🖐 When You Need to Act",
  help_section_ai_cta: "Still have questions?",
  help_ai_cta_desc: "Ask our Farm Intelligence AI anything about your crops",
  help_ai_cta_btn: "Ask AI →",
  help_range_label: "Ideal Range",
  help_low_label: "Too Low",
  help_high_label: "Too High",
  help_ai_label: "AI Auto-Action",
  help_manual_label: "Manual Needed When",
  help_agri_label: "Why It Matters",
  help_tab_simple: "Simple",
  help_tab_detail: "Detailed",

  // pH
  help_term_ph: "pH (Acidity of Water)",
  help_term_ph_short: "pH",
  help_term_ph_simple:
    "pH tells you if the water is sour (acidic) or bitter (alkaline). Think of lemon juice (very sour = low pH) vs. baking soda (bitter = high pH). Plants need water that is slightly acidic - not too sour, not too bitter.",
  help_term_ph_detail:
    "pH is measured on a scale from 0 to 14. A value of 7 is neutral (pure water). Below 7 is acidic. Above 7 is alkaline. In hydroponics, root cells absorb nutrients through a process that depends on water chemistry. If pH is wrong, roots physically cannot absorb nutrients even if they are present in the water.",
  help_term_ph_range: "5.5 - 6.5",
  help_term_ph_low:
    "Roots get damaged. Iron and manganese become toxic. Leaves turn yellow. Plant looks sick.",
  help_term_ph_high:
    "Nutrients lock up - plant cannot absorb calcium, magnesium, or iron. Leaves look pale and growth slows.",
  help_term_ph_ai:
    "If pH drops below 5.5, Demeter automatically doses base solution (pH Up) into the water. If pH rises above 6.5, it doses acid (pH Down). This happens within minutes without you needing to do anything.",
  help_term_ph_manual:
    "If pH keeps changing every hour even after dosing, your dosing pump may be broken or the tank may need a full water change. You will need to physically inspect the equipment.",
  help_term_ph_agri:
    "In traditional soil farming, pH affects nutrient availability too, but soil buffers changes slowly. In hydroponics, pH can shift within hours, so constant monitoring is critical. A wrong pH is the #1 cause of nutrient deficiency in hydroponic systems worldwide.",

  // EC
  help_term_ec: "EC (Electrical Conductivity / Nutrient Strength)",
  help_term_ec_short: "EC",
  help_term_ec_simple:
    "EC measures how many nutrients are dissolved in your water. Think of it like making tea - a little tea is fine, but too much tea (very dark) can be bitter and harmful. EC tells you if your water has the right amount of 'food' for the plant.",
  help_term_ec_detail:
    "EC (Electrical Conductivity) is measured in dS/m (deciSiemens per meter). Pure water conducts very little electricity. When you dissolve fertilizer salts in water, it conducts more electricity. The sensor measures this to determine nutrient concentration. High EC means too many salts - this draws water OUT of roots (osmotic stress). Low EC means the plant is not getting enough food.",
  help_term_ec_range: "0.8 - 2.5 dS/m",
  help_term_ec_low:
    "Plant is starving. Leaves become pale, growth slows, and yield drops. The plant has water but no food.",
  help_term_ec_high:
    "Nutrient burn. Leaf edges turn brown and crispy. Roots are under severe stress. In extreme cases the plant wilts even in wet conditions.",
  help_term_ec_ai:
    "If EC is too low, Demeter adds concentrated nutrient solution automatically. If EC is too high, it triggers water dilution (adding plain water to reduce concentration). The reinforcement learning agent adjusts the dose based on what worked in previous cycles.",
  help_term_ec_manual:
    "If EC spikes suddenly without explanation, it may indicate a pump failure delivering pure nutrient concentrate or contamination. Physically check the nutrient reservoir and all dosing lines.",
  help_term_ec_agri:
    "In soil farming, nutrients bind to soil particles and release slowly - this naturally buffers EC. In hydroponics, nutrients are directly in solution, making EC much more sensitive. Different crops need different EC: leafy greens prefer lower EC (0.8-1.6), while fruiting crops like tomatoes tolerate higher levels (2.0-3.5).",

  // Humidity
  help_term_humidity: "Humidity (Moisture in Air)",
  help_term_humidity_short: "Humidity",
  help_term_humidity_simple:
    "Humidity is how wet or dry the air feels. On a very humid day, you feel sweaty and sticky. Plants also 'breathe' through tiny holes in their leaves. If air is too wet, these holes clog and fungus grows. If air is too dry, leaves lose water too fast and wilt.",
  help_term_humidity_detail:
    "Humidity is measured as Relative Humidity (RH%) - the percentage of moisture in the air compared to the maximum it can hold at that temperature. Plants exchange gases and water vapor through structures called stomata (tiny pores). High humidity reduces evaporation from leaves, slowing the plant's 'transpiration pump' which is what drives nutrient uptake. Very high humidity (above 85%) creates perfect conditions for fungal diseases like powdery mildew and botrytis.",
  help_term_humidity_range: "40% - 80% RH",
  help_term_humidity_low:
    "Leaves curl and dry out. Stomata close to conserve water, halting photosynthesis and nutrient absorption. Severe drought stress.",
  help_term_humidity_high:
    "Fungal disease risk skyrockets. Powdery mildew, gray mold, and root rot become likely. Condensation on leaves also prevents photosynthesis.",
  help_term_humidity_ai:
    "Demeter controls fan speed automatically to regulate airflow and humidity. If humidity is high, fans speed up to improve air circulation. If it's too low, fans slow down. The atmospheric agent monitors and adjusts this continuously.",
  help_term_humidity_manual:
    "If humidity stays critically high despite maximum fan speed, it may indicate a structural issue - poor ventilation design, leaking irrigation, or a broken HVAC system. You will need physical intervention to fix the root cause.",
  help_term_humidity_agri:
    "In open-field farming, humidity is weather-dependent and uncontrollable. Indoor/hydroponic farming's great advantage is humidity control. Controlling humidity in the 60-70% range during vegetative growth, then dropping to 40-50% during flowering dramatically reduces disease pressure and improves yields.",

  // Temperature
  help_term_temp: "Temperature (Heat in the Air)",
  help_term_temp_short: "Temperature",
  help_term_temp_simple:
    "Temperature is how hot or cold the air is. Plants are like people - they prefer a comfortable temperature. Too cold and they 'slow down' and stop growing. Too hot and they get heat stroke, and bacteria in the water can multiply rapidly.",
  help_term_temp_detail:
    "Air temperature directly affects the rate of photosynthesis, respiration, enzyme activity, and transpiration in plants. The nutrient solution temperature is equally important - warm water holds less dissolved oxygen (DO), and roots need oxygen to function. Most hydroponic crops prefer 18-28°C air temperature. Below 15°C, enzymatic reactions slow dramatically. Above 30°C, nutrient uptake becomes erratic, and pathogenic bacteria proliferate in the root zone.",
  help_term_temp_range: "18°C - 28°C",
  help_term_temp_low:
    "Growth nearly stops. Roots may rot in cold water. Germination fails. Plant looks stunted and dark.",
  help_term_temp_high:
    "Roots suffocate (low dissolved oxygen). Pythium (root rot) explodes. Nutrient uptake becomes chaotic. Plant wilts despite having water.",
  help_term_temp_ai:
    "Demeter adjusts fan speed to control temperature. In warm conditions, fans run at full speed to remove heat. The atmospheric agent also considers humidity simultaneously. If temperature goes critically out of range, a CRITICAL alert is sent immediately.",
  help_term_temp_manual:
    "If temperature stays critically high despite maximum ventilation, you may need to add air conditioning, shade cloth, or cooling fans externally. If critically cold, a heater or grow light adjustment is needed. These are physical infrastructure changes the AI cannot make.",
  help_term_temp_agri:
    "Temperature management is one of the biggest advantages of indoor farming. In the field, late frost can kill an entire harvest overnight. Controlled environments eliminate this risk. Research shows that keeping temperature stable (minimal fluctuation between day/night) significantly improves nutrient uptake efficiency and reduces stress-related yield losses.",

  // Agents
  help_agent_fetch_name: "Fetch Agent",
  help_agent_fetch_role: "Reads all sensor data",
  help_agent_fetch_detail:
    "This agent collects pH, EC, temperature, humidity readings and any plant images. It's the eyes and ears of the system - everything starts here.",

  help_agent_judge_name: "Judge Agent",
  help_agent_judge_role: "Evaluates crop health",
  help_agent_judge_detail:
    "Using the sensor data, this agent scores the health of each crop and identifies which parameters are out of range. It flags Critical, Attention, or Healthy status.",

  help_agent_strategy_name: "Strategy Agent",
  help_agent_strategy_role: "Decides what action to take",
  help_agent_strategy_detail:
    "This is the brain. It uses reinforcement learning - it has learned from thousands of past cycles what actions work best for each crop type and situation. It picks the best corrective action.",

  help_agent_research_name: "Research Agent",
  help_agent_research_role: "Checks memory for similar cases",
  help_agent_research_detail:
    "Before acting, this agent searches through all past crop histories in its memory (Qdrant vector database) to find similar situations. It uses those precedents to refine the strategy.",

  help_agent_execute_name: "Execute Agent",
  help_agent_execute_role: "Sends commands to hardware",
  help_agent_execute_detail:
    "Once a plan is confirmed, this agent sends the actual commands to physical actuators - pumps, fans, dosing systems. It turns digital decisions into real-world actions.",

  help_agent_explainer_name: "Explainer Agent",
  help_agent_explainer_role: "Writes the reasoning in plain language",
  help_agent_explainer_detail:
    'After each cycle, this agent writes a human-readable explanation of what happened and why. That\'s what you see in the "AI Decision Reasoning" section of each crop.',

  // Growth Stages
  help_stage_seedling: "Seedling",
  help_stage_seedling_desc:
    "The plant has just sprouted from a seed. It's tiny, fragile, and just starting to grow its first leaves.",
  help_stage_seedling_tips:
    "🌡️ Keep temperature warm (22-26°C). 💧 Keep EC very low (0.5-1.0) - too much nutrient overwhelms fragile roots. 💡 Light should be gentle. This is the most fragile stage.",

  help_stage_vegetative: "Vegetative",
  help_stage_vegetative_desc:
    "The plant is growing leaves and stems rapidly. It's building its structure before it starts making flowers or fruit.",
  help_stage_vegetative_tips:
    "🌿 Increase nutrient strength (EC 1.2-2.0). 💧 Maintain humidity at 60-70%. This is when the plant grows fastest - it needs maximum nutrition.",

  help_stage_flowering: "Flowering",
  help_stage_flowering_desc:
    "The plant starts making flowers. This is a critical stage - conditions here directly affect how much fruit or produce you'll get.",
  help_stage_flowering_tips:
    "🌸 Reduce humidity to 50-60% to prevent bud rot. 🧪 Adjust nutrients - lower nitrogen, higher phosphorus/potassium. Handle the plant gently to avoid dropping flowers.",

  help_stage_fruiting: "Fruiting",
  help_stage_fruiting_desc:
    "Flowers have been pollinated and are now developing into fruits or final produce. The plant is putting all its energy into the harvest.",
  help_stage_fruiting_tips:
    "🍅 Maintain consistent EC and pH - fluctuations now can cause blossom end rot or splitting. 📉 Drop humidity to 40-50%. Watch maturity closely - harvest at the right time!",

  // Manual Intervention
  help_manual_disease_title: "Disease or Pest Outbreak",
  help_manual_disease_desc:
    "AI can detect visual anomalies using computer vision, but it cannot physically remove diseased leaves, apply pesticide sprays, or quarantine infected plants.",
  help_manual_disease_action:
    "Inspect the plant visually. Remove infected leaves immediately. Apply appropriate organic or chemical treatment. Isolate the batch if needed.",

  help_manual_equip_title: "Equipment or Sensor Failure",
  help_manual_equip_desc:
    "If a pump stops working, a sensor gives incorrect readings, or a fan breaks down, the AI will detect abnormal patterns but cannot physically fix hardware.",
  help_manual_equip_action:
    "Check all pumps, fans, and sensors physically. Look for blockages, broken wires, or clogged nozzles. Replace faulty equipment before the AI can resume normal control.",

  help_manual_harvest_title: "Harvest Time",
  help_manual_harvest_desc:
    "Demeter will alert you when a crop reaches maturity, but the actual harvesting must be done by you. The AI cannot pick crops.",
  help_manual_harvest_action:
    "When you see a HARVEST READY badge, act quickly. Delayed harvest reduces quality and may cause over-ripening or disease. Harvest during cooler parts of the day for best quality.",

  help_manual_extreme_title: "Extreme Environmental Conditions",
  help_manual_extreme_desc:
    "In case of power outages, floods, extreme heat waves, or structural damage to the growing area, manual intervention is always required.",
  help_manual_extreme_action:
    "Have a backup power plan (generator or UPS). Keep manual pH and EC test kits available. Know how to manually adjust nutrients if digital systems fail.",

  // How to Add a Crop
  help_section_add_crop: "🌿 How to Add a Crop",
  help_add_crop_step1: 'Click "Add Crop" in the dashboard',
  help_add_crop_step2:
    "Choose crop type - Lettuce, Tomato, Basil, or Strawberry",
  help_add_crop_step3: "Enter a unique Batch ID and optional location/notes",
  help_add_crop_step4:
    'Click "Register Crop" - the system auto-sets cycle duration and sensors',
  help_add_crop_step5:
    "After registration, go to the crop's Info tab → Run Agent Cycle",

  // Supported Crop Types
  help_section_crops: "🌱 Supported Crop Types",
  help_crop_lettuce: "Lettuce - ~21 days · 1h per cycle",
  help_crop_tomato: "Tomato - ~70 days · 2h per cycle",
  help_crop_basil: "Basil - ~28 days · 1h per cycle",
  help_crop_strawberry: "Strawberry - ~63 days · 2h per cycle",
};

const HELP_HI = {
  help_title: "सहायता और शब्दकोश",
  help_subtitle: "सब कुछ सरल भाषा में समझाया गया",
  help_section_terms: "📊 सेंसर शब्द समझाए गए",
  help_section_agents: "🤖 AI आपके लिए कैसे काम करता है",
  help_section_stages: "🌱 विकास की अवस्थाएं",
  help_section_manual: "🖐 जब आपको कदम उठाना हो",
  help_section_ai_cta: "अभी भी सवाल हैं?",
  help_ai_cta_desc:
    "हमारे फार्म बुद्धिमत्ता AI से अपनी फसलों के बारे में कुछ भी पूछें",
  help_ai_cta_btn: "AI से पूछें →",
  help_range_label: "आदर्श सीमा",
  help_low_label: "बहुत कम हो तो",
  help_high_label: "बहुत अधिक हो तो",
  help_ai_label: "AI स्वचालित कार्रवाई",
  help_manual_label: "मानवीय कार्रवाई कब जरूरी",
  help_agri_label: "यह क्यों महत्वपूर्ण है",
  help_tab_simple: "सरल",
  help_tab_detail: "विस्तृत",

  // pH
  help_term_ph: "pH (पानी की अम्लता)",
  help_term_ph_short: "pH",
  help_term_ph_simple:
    "pH बताता है कि पानी खट्टा (अम्लीय) है या कड़वा (क्षारीय)। नींबू के रस की तरह खट्टा = कम pH। बेकिंग सोडा की तरह कड़वा = ज्यादा pH। पौधों को थोड़ा खट्टा पानी चाहिए - न बहुत खट्टा, न बहुत कड़वा।",
  help_term_ph_detail:
    "pH 0 से 14 के पैमाने पर मापा जाता है। 7 का मतलब तटस्थ (शुद्ध पानी)। 7 से कम = अम्लीय। 7 से ज्यादा = क्षारीय। हाइड्रोपोनिक्स में, जड़ों की कोशिकाएं पानी की रसायन पर निर्भर एक प्रक्रिया से पोषक तत्व सोखती हैं। यदि pH गलत है, तो जड़ें पोषक तत्व सोख ही नहीं सकती, चाहे वे पानी में मौजूद क्यों न हों।",
  help_term_ph_range: "5.5 - 6.5",
  help_term_ph_low:
    "जड़ें खराब होती हैं। लोहा और मैंगनीज जहरीले हो जाते हैं। पत्तियां पीली पड़ती हैं। पौधा बीमार दिखता है।",
  help_term_ph_high:
    "पोषक तत्व 'बंद' हो जाते हैं - पौधा कैल्शियम, मैग्नीशियम या लोहा नहीं सोख सकता। पत्तियां फीकी पड़ती हैं और विकास धीमा होता है।",
  help_term_ph_ai:
    "अगर pH 5.5 से कम हो, Demeter स्वचालित रूप से base solution (pH Up) डालता है। अगर pH 6.5 से ज्यादा हो, तो acid (pH Down) डालता है। यह कुछ ही मिनटों में होता है, बिना आपके किए।",
  help_term_ph_manual:
    "अगर dosing के बाद भी pH हर घंटे बदलता रहे, तो आपका dosing pump खराब हो सकता है या टैंक में पानी बदलने की जरूरत है। उपकरण की शारीरिक जांच करें।",
  help_term_ph_agri:
    "पारंपरिक मिट्टी की खेती में, pH पोषक तत्वों की उपलब्धता को प्रभावित करता है, लेकिन मिट्टी बदलाव को धीरे-धीरे संभालती है। हाइड्रोपोनिक्स में, pH कुछ घंटों में बदल सकता है, इसलिए निरंतर निगरानी जरूरी है। गलत pH दुनिया भर में हाइड्रोपोनिक सिस्टम में पोषक तत्वों की कमी का #1 कारण है।",

  // EC
  help_term_ec: "EC (पानी में पोषक तत्वों की मात्रा)",
  help_term_ec_short: "EC",
  help_term_ec_simple:
    "EC बताता है कि पानी में कितने पोषक तत्व घुले हैं। चाय बनाने की तरह सोचें - थोड़ी चाय ठीक है, लेकिन बहुत गाढ़ी चाय कड़वी और हानिकारक होती है। EC बताता है कि पानी में पौधे के लिए सही मात्रा में 'खाना' है या नहीं।",
  help_term_ec_detail:
    "EC (विद्युत चालकता) को dS/m में मापा जाता है। शुद्ध पानी बहुत कम बिजली चलाता है। जब आप उर्वरक के नमक घोलते हैं, तो यह ज्यादा बिजली चलाता है। सेंसर इसे मापकर पोषक तत्वों की सांद्रता निर्धारित करता है। ज्यादा EC = बहुत अधिक नमक - यह जड़ों से पानी खींचता है (osmotic तनाव)।",
  help_term_ec_range: "0.8 - 2.5 dS/m",
  help_term_ec_low:
    "पौधा भूखा है। पत्तियां फीकी पड़ती हैं, विकास धीमा होता है, उपज कम होती है। पौधे के पास पानी है लेकिन खाना नहीं।",
  help_term_ec_high:
    "पोषक तत्व जल जाते हैं। पत्तियों के किनारे भूरे और कुरकुरे हो जाते हैं। जड़ें गंभीर तनाव में होती हैं।",
  help_term_ec_ai:
    "अगर EC बहुत कम हो, Demeter स्वचालित रूप से केंद्रित पोषक घोल डालता है। अगर EC बहुत ज्यादा हो, तो plain water डालकर सांद्रता कम करता है। reinforcement learning agent पिछले cycles से सीखकर सही मात्रा तय करता है।",
  help_term_ec_manual:
    "अगर EC अचानक बिना कारण बढ़ जाए, तो pump खराब हो सकता है या प्रदूषण हो सकता है। nutrient reservoir और सभी dosing lines की शारीरिक जांच करें।",
  help_term_ec_agri:
    "मिट्टी की खेती में, पोषक तत्व मिट्टी के कणों से जुड़े होते हैं और धीरे-धीरे निकलते हैं। हाइड्रोपोनिक्स में, पोषक तत्व सीधे घोल में होते हैं, जिससे EC बहुत संवेदनशील होती है। पत्तेदार सब्जियों के लिए कम EC (0.8-1.6), टमाटर जैसी फसलों के लिए ज्यादा (2.0-3.5) चाहिए।",

  // Humidity
  help_term_humidity: "नमी (हवा में पानी की मात्रा)",
  help_term_humidity_short: "नमी",
  help_term_humidity_simple:
    "नमी बताती है कि हवा कितनी नम या सूखी है। बहुत नम दिन पर आपको पसीना आता है। पौधे भी अपनी पत्तियों में छोटे छेदों से 'सांस' लेते हैं। अगर हवा बहुत नम हो, तो ये छेद बंद हो जाते हैं और फफूंद उगती है। बहुत सूखी हवा में पत्तियां जल्दी सूख जाती हैं।",
  help_term_humidity_detail:
    "नमी को Relative Humidity (RH%) में मापा जाता है। पौधे stomata (छोटे छिद्र) से गैस और जल वाष्प का आदान-प्रदान करते हैं। ज्यादा नमी में, पत्तियों से वाष्पीकरण कम होता है, जिससे 'transpiration pump' धीमा होता है - यही पोषक तत्व सोखने की प्रक्रिया को चलाता है। 85% से ज्यादा नमी में फफूंद रोग जैसे powdery mildew और botrytis के लिए आदर्श स्थितियां बन जाती हैं।",
  help_term_humidity_range: "40% - 80% RH",
  help_term_humidity_low:
    "पत्तियां मुड़ती और सूखती हैं। stomata बंद हो जाते हैं, प्रकाश संश्लेषण और पोषक तत्व अवशोषण रुक जाता है।",
  help_term_humidity_high:
    "फफूंद रोग का खतरा बढ़ जाता है। Powdery mildew, gray mold, और root rot की संभावना बढ़ती है।",
  help_term_humidity_ai:
    "Demeter हवा और नमी को नियंत्रित करने के लिए पंखे की गति स्वचालित रूप से बदलता है। ज्यादा नमी में पंखे तेज होते हैं। atmospheric agent इसे लगातार monitor और adjust करता है।",
  help_term_humidity_manual:
    "अगर अधिकतम पंखे की गति के बावजूद नमी बहुत ज्यादा रहे, तो यह structural समस्या हो सकती है - खराब ventilation, leaking irrigation, या टूटा हुआ HVAC। शारीरिक हस्तक्षेप जरूरी है।",
  help_term_humidity_agri:
    "खुली खेती में नमी मौसम पर निर्भर होती है। इनडोर/हाइड्रोपोनिक खेती का सबसे बड़ा फायदा नमी नियंत्रण है। vegetative growth में 60-70% और flowering में 40-50% नमी रखने से रोग कम होते हैं और उपज बढ़ती है।",

  // Temperature
  help_term_temp: "तापमान (हवा की गर्मी)",
  help_term_temp_short: "तापमान",
  help_term_temp_simple:
    "तापमान बताता है कि हवा कितनी गर्म या ठंडी है। पौधे भी इंसानों की तरह एक आरामदायक तापमान पसंद करते हैं। बहुत ठंडा होने पर वे 'धीमे' पड़ जाते हैं और बढ़ना बंद कर देते हैं। बहुत गर्म होने पर उन्हें 'heat stroke' होता है और पानी में बैक्टीरिया तेजी से बढ़ सकते हैं।",
  help_term_temp_detail:
    "हवा का तापमान प्रकाश संश्लेषण, श्वसन, एंजाइम गतिविधि और transpiration को सीधे प्रभावित करता है। पानी का तापमान भी उतना ही महत्वपूर्ण है - गर्म पानी में कम dissolved oxygen होती है, और जड़ों को oxygen चाहिए। 15°C से कम पर एंजाइम प्रतिक्रियाएं बहुत धीमी हो जाती हैं। 30°C से ज्यादा पर, pathogenic bacteria root zone में तेजी से बढ़ते हैं।",
  help_term_temp_range: "18°C - 28°C",
  help_term_temp_low:
    "विकास लगभग रुक जाता है। ठंडे पानी में जड़ें सड़ सकती हैं। पौधा बौना और काला दिखता है।",
  help_term_temp_high:
    "जड़ें दम घुटती हैं (कम dissolved oxygen)। Pythium (root rot) फैल जाता है। पानी होने के बावजूद पौधा मुरझा जाता है।",
  help_term_temp_ai:
    "Demeter तापमान नियंत्रण के लिए पंखे की गति बदलता है। गर्म स्थितियों में पंखे पूरी गति से चलते हैं। atmospheric agent एक साथ नमी भी देखता है। तापमान गंभीर रूप से बाहर जाने पर तुरंत CRITICAL alert भेजा जाता है।",
  help_term_temp_manual:
    "अगर अधिकतम ventilation के बावजूद तापमान बहुत ज्यादा रहे, तो AC, shade cloth, या बाहरी cooling fans लगाने की जरूरत हो सकती है। अगर बहुत ठंडा हो, तो heater या grow light adjustment जरूरी है। ये शारीरिक बदलाव AI नहीं कर सकता।",
  help_term_temp_agri:
    "तापमान प्रबंधन इनडोर खेती का सबसे बड़ा फायदा है। खेत में देर से आने वाली ठंड पूरी फसल रात भर में बर्बाद कर सकती है। नियंत्रित वातावरण इस जोखिम को खत्म करता है।",

  // Agents
  help_agent_fetch_name: "Fetch Agent",
  help_agent_fetch_role: "सभी सेंसर डेटा पढ़ता है",
  help_agent_fetch_detail:
    "यह agent pH, EC, तापमान, नमी की रीडिंग और पौधे की तस्वीरें एकत्र करता है। यह सिस्टम की आंखें और कान हैं - सब कुछ यहीं से शुरू होता है।",

  help_agent_judge_name: "Judge Agent",
  help_agent_judge_role: "फसल के स्वास्थ्य का मूल्यांकन करता है",
  help_agent_judge_detail:
    "सेंसर डेटा का उपयोग करके, यह agent प्रत्येक फसल के स्वास्थ्य को स्कोर करता है और पहचानता है कि कौन से parameter सीमा से बाहर हैं। Critical, Attention, या Healthy status देता है।",

  help_agent_strategy_name: "Strategy Agent",
  help_agent_strategy_role: "क्या कार्रवाई करनी है यह तय करता है",
  help_agent_strategy_detail:
    "यह दिमाग है। reinforcement learning का उपयोग करता है - हजारों पिछले cycles से सीखा है कि हर फसल के प्रकार और स्थिति में कौन सी कार्रवाई सबसे अच्छी है।",

  help_agent_research_name: "Research Agent",
  help_agent_research_role: "समान मामलों के लिए memory जांचता है",
  help_agent_research_detail:
    "कार्रवाई से पहले, यह agent अपनी memory (Qdrant vector database) में सभी पिछले crop histories खोजता है। इन precedents का उपयोग करके strategy को बेहतर बनाता है।",

  help_agent_execute_name: "Execute Agent",
  help_agent_execute_role: "hardware को commands भेजता है",
  help_agent_execute_detail:
    "एक बार योजना confirm होने पर, यह agent physical actuators - pumps, fans, dosing systems - को actual commands भेजता है। digital निर्णयों को real-world actions में बदलता है।",

  help_agent_explainer_name: "Explainer Agent",
  help_agent_explainer_role: "सरल भाषा में reasoning लिखता है",
  help_agent_explainer_detail:
    'प्रत्येक cycle के बाद, यह agent एक human-readable explanation लिखता है कि क्या हुआ और क्यों। यही आप हर फसल की "AI निर्णय तर्क" section में देखते हैं।',

  // Stages
  help_stage_seedling: "अंकुर (Seedling)",
  help_stage_seedling_desc:
    "पौधा बीज से अभी-अभी उगा है। यह बहुत छोटा, नाजुक है और अपनी पहली पत्तियां उगाना शुरू कर रहा है।",
  help_stage_seedling_tips:
    "🌡️ तापमान गर्म रखें (22-26°C)। 💧 EC बहुत कम रखें (0.5-1.0) - ज्यादा पोषक तत्व नाजुक जड़ों को नुकसान पहुंचाते हैं। 💡 रोशनी हल्की होनी चाहिए। यह सबसे नाजुक अवस्था है।",

  help_stage_vegetative: "वानस्पतिक (Vegetative)",
  help_stage_vegetative_desc:
    "पौधा तेजी से पत्तियां और तना उगा रहा है। फूल या फल बनाने से पहले अपनी संरचना बना रहा है।",
  help_stage_vegetative_tips:
    "🌿 पोषक तत्वों की मात्रा बढ़ाएं (EC 1.2-2.0)। 💧 नमी 60-70% बनाए रखें। यही वह समय है जब पौधा सबसे तेज बढ़ता है।",

  help_stage_flowering: "फूल (Flowering)",
  help_stage_flowering_desc:
    "पौधा फूल बनाना शुरू करता है। यह एक महत्वपूर्ण अवस्था है - यहां की स्थितियां सीधे प्रभावित करती हैं कि आपको कितनी उपज मिलेगी।",
  help_stage_flowering_tips:
    "🌸 bud rot रोकने के लिए नमी 50-60% तक कम करें। 🧪 पोषक तत्व बदलें - nitrogen कम, phosphorus/potassium ज्यादा। फूल गिरने से बचाने के लिए पौधे को धीरे से संभालें।",

  help_stage_fruiting: "फल (Fruiting)",
  help_stage_fruiting_desc:
    "फूलों पर परागण हो चुका है और अब फल या अंतिम उपज बन रही है। पौधा अपनी सारी ऊर्जा कटाई में लगा रहा है।",
  help_stage_fruiting_tips:
    "🍅 EC और pH में स्थिरता बनाए रखें - अब उतार-चढ़ाव से blossom end rot या splitting हो सकती है। 📉 नमी 40-50% तक कम करें। परिपक्वता पर नज़र रखें - सही समय पर काटें!",

  // Manual Intervention
  help_manual_disease_title: "बीमारी या कीट का प्रकोप",
  help_manual_disease_desc:
    "AI computer vision से दृश्य असामान्यताएं पकड़ सकता है, लेकिन शारीरिक रूप से बीमार पत्तियां नहीं हटा सकता, कीटनाशक स्प्रे नहीं कर सकता, या संक्रमित पौधों को अलग नहीं कर सकता।",
  help_manual_disease_action:
    "पौधे को ध्यान से देखें। संक्रमित पत्तियां तुरंत हटाएं। उचित organic या chemical उपचार करें। जरूरत पड़ने पर batch को अलग करें।",

  help_manual_equip_title: "उपकरण या सेंसर की खराबी",
  help_manual_equip_desc:
    "अगर pump काम नहीं करता, sensor गलत readings दे रहा है, या fan टूट जाता है, तो AI असामान्य patterns पकड़ेगा लेकिन hardware को शारीरिक रूप से ठीक नहीं कर सकता।",
  help_manual_equip_action:
    "सभी pumps, fans, और sensors की शारीरिक जांच करें। blockages, टूटे तार, या बंद नोज़ल खोजें। खराब उपकरण बदलें।",

  help_manual_harvest_title: "कटाई का समय",
  help_manual_harvest_desc:
    "Demeter आपको सचेत करेगा जब फसल पक जाए, लेकिन असली कटाई आपको करनी होगी। AI फसल नहीं काट सकता।",
  help_manual_harvest_action:
    "HARVEST READY बैज दिखने पर जल्दी काम करें। देरी से गुणवत्ता कम होती है। दिन के ठंडे हिस्से में कटाई करें।",

  help_manual_extreme_title: "अत्यधिक पर्यावरणीय स्थितियां",
  help_manual_extreme_desc:
    "बिजली कटौती, बाढ़, अत्यधिक गर्मी, या growing area को structural क्षति के मामले में, मानवीय हस्तक्षेप हमेशा जरूरी है।",
  help_manual_extreme_action:
    "backup power plan (generator या UPS) रखें। manual pH और EC test kits उपलब्ध रखें। digital systems विफल होने पर manually nutrients adjust करना जानें।",

  // How to Add a Crop
  help_section_add_crop: "🌿 फसल कैसे जोड़ें",
  help_add_crop_step1: 'डैशबोर्ड में "फसल जोड़ें" पर क्लिक करें',
  help_add_crop_step2:
    "फसल का प्रकार चुनें - लेट्यूस, टमाटर, तुलसी, या स्ट्रॉबेरी",
  help_add_crop_step3: "एक अनोखी Batch ID और वैकल्पिक स्थान/नोट्स दर्ज करें",
  help_add_crop_step4:
    '"फसल दर्ज करें" पर क्लिक करें - सिस्टम स्वचालित रूप से चक्र अवधि और सेंसर सेट करेगा',
  help_add_crop_step5:
    "दर्ज होने के बाद, फसल के Info टैब से → एजेंट चक्र चलाएं",

  // Supported Crop Types
  help_section_crops: "🌱 समर्थित फसल प्रकार",
  help_crop_lettuce: "लेट्यूस - ~21 दिन · प्रति चक्र 1 घंटा",
  help_crop_tomato: "टमाटर - ~70 दिन · प्रति चक्र 2 घंटे",
  help_crop_basil: "तुलसी - ~28 दिन · प्रति चक्र 1 घंटा",
  help_crop_strawberry: "स्ट्रॉबेरी - ~63 दिन · प्रति चक्र 2 घंटे",
};

// Sub-components

function SectionHeader({ children }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: "var(--green)",
        fontFamily: "DM Mono, monospace",
        letterSpacing: "0.06em",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

function TermCard({ term, lang }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("simple");
  const dict = lang === "hi" ? HELP_HI : HELP_EN;
  const Icon = term.icon;

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        overflow: "hidden",
        transition: "all 0.2s",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${term.color}18`,
            border: `1px solid ${term.color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={18} style={{ color: term.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            {dict[term.labelKey]}
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
              marginTop: 2,
            }}
          >
            {dict["help_range_label"]}: {dict[term.rangeKey]}
          </div>
        </div>
        <div style={{ color: "var(--text-3)", flexShrink: 0 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div
          style={{
            padding: "0 20px 20px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {/* Tab toggles */}
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 14,
              marginBottom: 14,
            }}
          >
            {["simple", "detail"].map((tabId) => (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "DM Mono, monospace",
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: tab === tabId ? term.color : "var(--border)",
                  background: tab === tabId ? `${term.color}15` : "transparent",
                  color: tab === tabId ? term.color : "var(--text-3)",
                  transition: "all 0.15s",
                }}
              >
                {tabId === "simple"
                  ? dict["help_tab_simple"]
                  : dict["help_tab_detail"]}
              </button>
            ))}
          </div>

          {/* Explanation */}
          <p
            className="animate-fade-in"
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.75,
              margin: 0,
              marginBottom: 16,
              opacity: 0,
              animationFillMode: "forwards",
            }}
          >
            {tab === "simple" ? dict[term.simpleKey] : dict[term.detailKey]}
          </p>

          {/* Range cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--red)",
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                ↓ {dict["help_low_label"]}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  lineHeight: 1.5,
                }}
              >
                {dict[term.lowKey]}
              </div>
            </div>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--red)",
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                ↑ {dict["help_high_label"]}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  lineHeight: 1.5,
                }}
              >
                {dict[term.highKey]}
              </div>
            </div>
          </div>

          {/* AI Action */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(74,222,128,0.07)",
              border: "1px solid rgba(74,222,128,0.2)",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                color: "var(--green)",
                marginBottom: 6,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Bot size={10} /> {dict["help_ai_label"]}
            </div>
            <div
              style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}
            >
              {dict[term.aiActionKey]}
            </div>
          </div>

          {/* Manual needed */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(245,158,11,0.07)",
              border: "1px solid rgba(245,158,11,0.2)",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                color: "var(--amber)",
                marginBottom: 6,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <HandMetal size={10} /> {dict["help_manual_label"]}
            </div>
            <div
              style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}
            >
              {dict[term.manualKey]}
            </div>
          </div>

          {/* Agricultural context */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(99,102,241,0.07)",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                color: "#818cf8",
                marginBottom: 6,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Info size={10} /> {dict["help_agri_label"]}
            </div>
            <div
              style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}
            >
              {dict[term.agriKey]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, dict }) {
  const [open, setOpen] = useState(false);
  const Icon = agent.icon;
  return (
    <div
      onClick={() => setOpen(!open)}
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: `${agent.color}15`,
            border: `1px solid ${agent.color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={15} style={{ color: agent.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            {dict[agent.nameKey]}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
            {dict[agent.roleKey]}
          </div>
        </div>
        <div style={{ color: "var(--text-3)" }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>
      {open && (
        <div
          className="animate-fade-in"
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-2)",
            lineHeight: 1.65,
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          {dict[agent.detailKey]}
        </div>
      )}
    </div>
  );
}

function StageCard({ stage, dict }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>{stage.emoji}</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        {dict[stage.nameKey]}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-2)",
          lineHeight: 1.6,
          marginBottom: 10,
        }}
      >
        {dict[stage.descKey]}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          lineHeight: 1.7,
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
        }}
      >
        {dict[stage.tipsKey]}
      </div>
    </div>
  );
}

function ManualCard({ scenario, dict }) {
  const Icon = scenario.icon;
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: 12,
        border: `1px solid ${scenario.color}30`,
        background: `${scenario.color}07`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Icon
          size={16}
          style={{ color: scenario.color, flexShrink: 0, marginTop: 2 }}
        />
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            {dict[scenario.titleKey]}
          </div>
          <div
            style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}
          >
            {dict[scenario.descKey]}
          </div>
        </div>
      </div>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--text-2)",
          lineHeight: 1.6,
        }}
      >
        <span style={{ fontWeight: 700, color: scenario.color }}>✓ </span>
        {dict[scenario.actionKey]}
      </div>
    </div>
  );
}

function StepCard({ step, dict, index }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        transition: "all 0.2s",
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 8,
          background: `${step.color}18`,
          border: `1px solid ${step.color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontFamily: "DM Mono, monospace",
          fontSize: 12,
          fontWeight: 700,
          color: step.color,
        }}
      >
        {step.icon}
      </div>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-2)",
          lineHeight: 1.6,
          paddingTop: 1,
        }}
      >
        {dict[step.key]}
      </span>
    </div>
  );
}

function CropTypeCard({ crop, dict }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        transition: "all 0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `${crop.color}15`,
            border: `1px solid ${crop.color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {crop.emoji}
        </div>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: "var(--text)",
            }}
          >
            {dict[crop.key].split("-")[0].trim()}
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
              marginTop: 1,
            }}
          >
            ~{crop.days} days · {crop.cycle}/cycle
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {crop.stages.map((stage, si) => (
          <span
            key={stage}
            style={{
              fontSize: 9,
              fontFamily: "DM Mono, monospace",
              padding: "3px 8px",
              borderRadius: 5,
              background:
                si === crop.stages.length - 1
                  ? `${crop.color}18`
                  : "var(--bg-3)",
              color:
                si === crop.stages.length - 1 ? crop.color : "var(--text-3)",
              border: `1px solid ${si === crop.stages.length - 1 ? `${crop.color}35` : "var(--border)"}`,
              textTransform: "capitalize",
            }}
          >
            {stage}
          </span>
        ))}
      </div>
    </div>
  );
}

// MAIN

export default function Help() {
  const { lang } = useT();
  const navigate = useNavigate();
  const dict = lang === "hi" ? HELP_HI : HELP_EN;

  return (
    <div
      className="animate-fade-scale"
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "28px 24px",
        maxWidth: 800,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="animate-fade-in"
        style={{
          background: "none",
          border: "none",
          color: "var(--text-3)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          marginBottom: 20,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          transition: "color 0.2s",
          opacity: 0,
          animationFillMode: "forwards",
        }}
      >
        <ArrowLeft size={16} />
        {lang === "hi" ? "वापस जाएँ" : "Back"}
      </button>

      {/* Page Header */}
      <div
        className="animate-slide-down-right"
        style={{
          marginBottom: 28,
          opacity: 0,
          animationFillMode: "forwards",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "rgba(74,222,128,0.12)",
              border: "1px solid rgba(74,222,128,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HelpCircle size={18} style={{ color: "var(--green)" }} />
          </div>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "var(--text)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {dict["help_title"]}
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
              {dict["help_subtitle"]}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Sensor Terms */}
      <section style={{ marginBottom: 36 }}>
        <div
          className="animate-fade-up"
          style={{
            animationDelay: "0.1s",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          <SectionHeader>{dict["help_section_terms"]}</SectionHeader>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TERMS.map((term, i) => (
            <div
              key={term.id}
              className="animate-fade-up"
              style={{
                animationDelay: `${0.15 + i * 0.05}s`,
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              <TermCard term={term} lang={lang} />
            </div>
          ))}
        </div>
      </section>

      {/* Section: AI Agents */}
      <section style={{ marginBottom: 36 }}>
        <div
          className="animate-fade-up"
          style={{
            animationDelay: "0.2s",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          <SectionHeader>{dict["help_section_agents"]}</SectionHeader>
        </div>

        {/* Pipeline flow visualization */}
        <div
          className="animate-fade-up"
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            animationDelay: "0.25s",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          {["Fetch", "Judge", "Strategy", "Research", "Execute", "Explain"].map(
            (step, i, arr) => (
              <React.Fragment key={step}>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "rgba(74,222,128,0.12)",
                    border: "1px solid rgba(74,222,128,0.25)",
                    fontSize: 11,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--green)",
                  }}
                >
                  {step}
                </span>
                {i < arr.length - 1 && (
                  <ChevronRight size={12} style={{ color: "var(--text-3)" }} />
                )}
              </React.Fragment>
            ),
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {AI_AGENTS.map((agent, i) => (
            <div
              key={agent.id}
              className="animate-fade-up"
              style={{
                animationDelay: `${0.3 + i * 0.05}s`,
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              <AgentCard agent={agent} dict={dict} />
            </div>
          ))}
        </div>
      </section>

      {/* Section: Growth Stages */}
      <section style={{ marginBottom: 36 }}>
        <div
          className="animate-fade-up"
          style={{
            animationDelay: "0.4s",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          <SectionHeader>{dict["help_section_stages"]}</SectionHeader>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {STAGES.map((stage, i) => (
            <div
              key={stage.id}
              className="animate-fade-up"
              style={{
                animationDelay: `${0.45 + i * 0.05}s`,
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              <StageCard stage={stage} dict={dict} />
            </div>
          ))}
        </div>
      </section>

      {/* Section: Manual Intervention */}
      <section style={{ marginBottom: 36 }}>
        <div
          className="animate-fade-up"
          style={{
            animationDelay: "0.5s",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          <SectionHeader>{dict["help_section_manual"]}</SectionHeader>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MANUAL_SCENARIOS.map((s, i) => (
            <div
              key={s.id}
              className="animate-fade-up"
              style={{
                animationDelay: `${0.55 + i * 0.05}s`,
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              <ManualCard scenario={s} dict={dict} />
            </div>
          ))}
        </div>
      </section>

      {/* Section: How to Add a Crop */}
      <section style={{ marginBottom: 36 }}>
        <div
          className="animate-fade-up"
          style={{
            animationDelay: "0.6s",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          <SectionHeader>{dict["help_section_add_crop"]}</SectionHeader>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { key: "help_add_crop_step1", icon: "1", color: "var(--blue)" },
            { key: "help_add_crop_step2", icon: "2", color: "var(--green)" },
            { key: "help_add_crop_step3", icon: "3", color: "var(--amber)" },
            { key: "help_add_crop_step4", icon: "4", color: "var(--blue)" },
            { key: "help_add_crop_step5", icon: "5", color: "var(--green)" },
          ].map((step, i) => (
            <div
              key={step.key}
              className="animate-fade-up"
              style={{
                animationDelay: `${0.65 + i * 0.05}s`,
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              <StepCard step={step} dict={dict} index={i} />
            </div>
          ))}
        </div>
      </section>

      {/* Section: Supported Crops */}
      <section style={{ marginBottom: 36 }}>
        <div
          className="animate-fade-up"
          style={{
            animationDelay: "0.7s",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          <SectionHeader>{dict["help_section_crops"]}</SectionHeader>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
          }}
        >
          {[
            {
              key: "help_crop_lettuce",
              emoji: "🥬",
              days: 21,
              cycle: "1h",
              stages: ["Seedling", "Vegetative", "Harvest"],
              color: "var(--green)",
            },
            {
              key: "help_crop_tomato",
              emoji: "🍅",
              days: 70,
              cycle: "2h",
              stages: ["Seedling", "Vegetative", "Flowering", "Fruiting"],
              color: "var(--red)",
            },
            {
              key: "help_crop_basil",
              emoji: "🌿",
              days: 28,
              cycle: "1h",
              stages: ["Seedling", "Vegetative", "Harvest"],
              color: "var(--green)",
            },
            {
              key: "help_crop_strawberry",
              emoji: "🍓",
              days: 63,
              cycle: "2h",
              stages: ["Seedling", "Vegetative", "Flowering", "Fruiting"],
              color: "var(--amber)",
            },
          ].map((crop, i) => (
            <div
              key={crop.key}
              className="animate-fade-up"
              style={{
                animationDelay: `${0.75 + i * 0.05}s`,
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              <CropTypeCard crop={crop} dict={dict} />
            </div>
          ))}
        </div>
      </section>

      {/* AI CTA */}
      <div
        className="animate-fade-scale"
        style={{
          padding: "24px",
          borderRadius: 16,
          background:
            "linear-gradient(135deg, rgba(74,222,128,0.08), rgba(74,222,128,0.03))",
          border: "1px solid rgba(74,222,128,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 8,
          animationDelay: "0.8s",
          opacity: 0,
          animationFillMode: "forwards",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            {dict["help_section_ai_cta"]}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>
            {dict["help_ai_cta_desc"]}
          </div>
        </div>
        <PrimaryButton
          onClick={() => navigate("/intelligence")}
          icon={Sparkles}
        >
          {dict["help_ai_cta_btn"]}
        </PrimaryButton>
      </div>
    </div>
  );
}
