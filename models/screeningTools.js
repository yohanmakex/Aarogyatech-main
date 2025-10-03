/**
 * Mental Health Screening Tools Data Models
 * Includes PHQ-9, GAD-7, and GHQ-12 questionnaires
 */

const PHQ9 = {
  name: 'PHQ-9',
  fullName: 'Patient Health Questionnaire-9',
  description: 'Screening tool for depression severity',
  type: 'depression',
  timeframe: 'over the last 2 weeks',
  questions: [
    {
      id: 'phq9_1',
      text: 'Little interest or pleasure in doing things',
      category: 'anhedonia'
    },
    {
      id: 'phq9_2', 
      text: 'Feeling down, depressed, or hopeless',
      category: 'mood'
    },
    {
      id: 'phq9_3',
      text: 'Trouble falling or staying asleep, or sleeping too much',
      category: 'sleep'
    },
    {
      id: 'phq9_4',
      text: 'Feeling tired or having little energy',
      category: 'energy'
    },
    {
      id: 'phq9_5',
      text: 'Poor appetite or overeating',
      category: 'appetite'
    },
    {
      id: 'phq9_6',
      text: 'Feeling bad about yourself - or that you are a failure or have let yourself or your family down',
      category: 'self-worth'
    },
    {
      id: 'phq9_7',
      text: 'Trouble concentrating on things, such as reading the newspaper or watching television',
      category: 'concentration'
    },
    {
      id: 'phq9_8',
      text: 'Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual',
      category: 'psychomotor'
    },
    {
      id: 'phq9_9',
      text: 'Thoughts that you would be better off dead, or of hurting yourself in some way',
      category: 'suicidal_ideation',
      requiresFollowUp: true
    }
  ],
  responseOptions: [
    { value: 0, text: 'Not at all' },
    { value: 1, text: 'Several days' },
    { value: 2, text: 'More than half the days' },
    { value: 3, text: 'Nearly every day' }
  ],
  scoring: {
    ranges: [
      { min: 0, max: 4, level: 'minimal', description: 'Minimal depression' },
      { min: 5, max: 9, level: 'mild', description: 'Mild depression' },
      { min: 10, max: 14, level: 'moderate', description: 'Moderate depression' },
      { min: 15, max: 19, level: 'moderately_severe', description: 'Moderately severe depression' },
      { min: 20, max: 27, level: 'severe', description: 'Severe depression' }
    ],
    maxScore: 27,
    clinicalCutoff: 10
  }
};

const GAD7 = {
  name: 'GAD-7',
  fullName: 'Generalized Anxiety Disorder 7-item scale',
  description: 'Screening tool for generalized anxiety disorder',
  type: 'anxiety',
  timeframe: 'over the last 2 weeks',
  questions: [
    {
      id: 'gad7_1',
      text: 'Feeling nervous, anxious, or on edge',
      category: 'nervousness'
    },
    {
      id: 'gad7_2',
      text: 'Not being able to stop or control worrying',
      category: 'worry_control'
    },
    {
      id: 'gad7_3',
      text: 'Worrying too much about different things',
      category: 'excessive_worry'
    },
    {
      id: 'gad7_4',
      text: 'Trouble relaxing',
      category: 'relaxation'
    },
    {
      id: 'gad7_5',
      text: 'Being so restless that it is hard to sit still',
      category: 'restlessness'
    },
    {
      id: 'gad7_6',
      text: 'Becoming easily annoyed or irritable',
      category: 'irritability'
    },
    {
      id: 'gad7_7',
      text: 'Feeling afraid, as if something awful might happen',
      category: 'fear'
    }
  ],
  responseOptions: [
    { value: 0, text: 'Not at all' },
    { value: 1, text: 'Several days' },
    { value: 2, text: 'More than half the days' },
    { value: 3, text: 'Nearly every day' }
  ],
  scoring: {
    ranges: [
      { min: 0, max: 4, level: 'minimal', description: 'Minimal anxiety' },
      { min: 5, max: 9, level: 'mild', description: 'Mild anxiety' },
      { min: 10, max: 14, level: 'moderate', description: 'Moderate anxiety' },
      { min: 15, max: 21, level: 'severe', description: 'Severe anxiety' }
    ],
    maxScore: 21,
    clinicalCutoff: 10
  }
};

const GHQ12 = {
  name: 'GHQ-12',
  fullName: 'General Health Questionnaire-12',
  description: 'Screening tool for general psychological distress',
  type: 'general_distress',
  timeframe: 'over the past few weeks',
  questions: [
    {
      id: 'ghq12_1',
      text: 'Been able to concentrate on whatever you\'re doing',
      category: 'concentration',
      reversed: true
    },
    {
      id: 'ghq12_2',
      text: 'Lost much sleep over worry',
      category: 'sleep_worry'
    },
    {
      id: 'ghq12_3',
      text: 'Felt that you were playing a useful part in things',
      category: 'usefulness',
      reversed: true
    },
    {
      id: 'ghq12_4',
      text: 'Felt capable of making decisions about things',
      category: 'decision_making',
      reversed: true
    },
    {
      id: 'ghq12_5',
      text: 'Felt constantly under strain',
      category: 'strain'
    },
    {
      id: 'ghq12_6',
      text: 'Felt you couldn\'t overcome your difficulties',
      category: 'coping'
    },
    {
      id: 'ghq12_7',
      text: 'Been able to enjoy your normal day-to-day activities',
      category: 'enjoyment',
      reversed: true
    },
    {
      id: 'ghq12_8',
      text: 'Been able to face up to problems',
      category: 'problem_facing',
      reversed: true
    },
    {
      id: 'ghq12_9',
      text: 'Been feeling unhappy or depressed',
      category: 'mood'
    },
    {
      id: 'ghq12_10',
      text: 'Been losing confidence in yourself',
      category: 'confidence'
    },
    {
      id: 'ghq12_11',
      text: 'Been thinking of yourself as a worthless person',
      category: 'self_worth'
    },
    {
      id: 'ghq12_12',
      text: 'Been feeling reasonably happy, all things considered',
      category: 'happiness',
      reversed: true
    }
  ],
  responseOptions: [
    { value: 0, text: 'Better than usual' },
    { value: 1, text: 'Same as usual' },
    { value: 2, text: 'Less than usual' },
    { value: 3, text: 'Much less than usual' }
  ],
  alternativeResponseOptions: [
    { value: 0, text: 'More so than usual' },
    { value: 1, text: 'Same as usual' },
    { value: 2, text: 'Less so than usual' },
    { value: 3, text: 'Much less than usual' }
  ],
  scoring: {
    ranges: [
      { min: 0, max: 11, level: 'normal', description: 'No psychological distress' },
      { min: 12, max: 15, level: 'mild', description: 'Mild psychological distress' },
      { min: 16, max: 20, level: 'moderate', description: 'Moderate psychological distress' },
      { min: 21, max: 36, level: 'severe', description: 'Severe psychological distress' }
    ],
    maxScore: 36,
    clinicalCutoff: 12,
    binaryScoring: {
      // Alternative GHQ scoring method (0-0-1-1)
      ranges: [
        { min: 0, max: 2, level: 'normal', description: 'No psychological distress' },
        { min: 3, max: 12, level: 'distressed', description: 'Psychological distress present' }
      ],
      maxScore: 12,
      clinicalCutoff: 3
    }
  }
};

// Additional screening tools that could be added in the future
const FUTURE_TOOLS = {
  PSS10: {
    name: 'PSS-10',
    fullName: 'Perceived Stress Scale-10',
    description: 'Measures perceived stress levels',
    type: 'stress'
  },
  DASS21: {
    name: 'DASS-21',
    fullName: 'Depression, Anxiety and Stress Scale-21',
    description: 'Comprehensive assessment of depression, anxiety, and stress',
    type: 'comprehensive'
  },
  PC_PTSD5: {
    name: 'PC-PTSD-5',
    fullName: 'Primary Care PTSD Screen for DSM-5',
    description: 'PTSD screening tool',
    type: 'ptsd'
  }
};

// Recommendation logic for when to use which tool
const SCREENING_RECOMMENDATIONS = {
  depression: ['PHQ-9'],
  anxiety: ['GAD-7'],
  general_distress: ['GHQ-12'],
  comprehensive: ['PHQ-9', 'GAD-7'],
  followup: ['GHQ-12'],
  initial: ['GHQ-12', 'PHQ-9']
};

// Crisis indicators that require immediate attention
const CRISIS_INDICATORS = {
  suicidalIdeation: {
    tools: ['PHQ-9'],
    questions: ['phq9_9'],
    threshold: 1, // Any score above 0
    action: 'immediate_intervention'
  },
  severeDepression: {
    tools: ['PHQ-9'],
    threshold: 20,
    action: 'urgent_referral'
  },
  severeAnxiety: {
    tools: ['GAD-7'],
    threshold: 15,
    action: 'urgent_referral'
  },
  severeDistress: {
    tools: ['GHQ-12'],
    threshold: 21,
    action: 'urgent_referral'
  }
};

module.exports = {
  PHQ9,
  GAD7,
  GHQ12,
  FUTURE_TOOLS,
  SCREENING_RECOMMENDATIONS,
  CRISIS_INDICATORS,
  // Helper function to get all available tools
  getAllTools: () => ({
    'PHQ-9': PHQ9,
    'GAD-7': GAD7,
    'GHQ-12': GHQ12
  }),
  // Helper function to get tool by name
  getTool: (name) => {
    const tools = {
      'PHQ-9': PHQ9,
      'GAD-7': GAD7,
      'GHQ-12': GHQ12
    };
    return tools[name] || null;
  }
};