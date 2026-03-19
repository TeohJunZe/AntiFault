import { Machine } from './data';

export type IntentOutput = {
  intents: Array<{
    intent: string; // e.g., "GET_MACHINE_STATUS", "ANOMALY_CHECK", "PREDICTION", "COMPARE", "INVALID"
    machine?: string;
    parameter?: string; // "temperature", "vibration", "all"
    confidence: number;
  }>;
};

export type ContextMemory = {
  history: Array<{
    machine?: string;
    parameter?: string;
    intent: string;
  }>;
};

export function getLastMachine(memory: ContextMemory): string | undefined {
  for (let i = memory.history.length - 1; i >= 0; i--) {
    if (memory.history[i].machine) {
      return memory.history[i].machine;
    }
  }
  return undefined;
}

export function updateContext(intentOutput: IntentOutput, memory: ContextMemory): ContextMemory {
  const newHistory = [...memory.history];
  
  intentOutput.intents.forEach(intent => {
    newHistory.push({
      machine: intent.machine,
      parameter: intent.parameter,
      intent: intent.intent
    });
  });

  // Keep last 5
  if (newHistory.length > 5) {
    newHistory.splice(0, newHistory.length - 5);
  }

  return { history: newHistory };
}

// Basic mock parser
export async function parseIntent(text: string, memory: ContextMemory): Promise<IntentOutput> {
  const lower = text.toLowerCase();
  const intents: IntentOutput['intents'] = [];
  
  // Try finding machine
  let machineStr: string | undefined = undefined;
  if (lower.includes('motor a') || lower.includes('motor-a')) machineStr = 'Motor-A';
  else if (lower.includes('press-02') || lower.includes('press 02')) machineStr = 'Press-02';
  else if (lower.includes('lathe')) machineStr = 'Lathe-03';
  else {
    machineStr = getLastMachine(memory);
  }

  if (lower.includes('compare')) {
    intents.push({ intent: 'COMPARE', confidence: 0.9, machine: machineStr });
  } else if (lower.includes('predict') || lower.includes('future') || lower.includes('when')) {
    intents.push({ intent: 'PREDICTION', confidence: 0.8, machine: machineStr });
  } else if (lower.includes('alert') || lower.includes('issue') || lower.includes('urgent') || lower.includes('anomaly')) {
    intents.push({ intent: 'ANOMALY_CHECK', confidence: 0.85, machine: machineStr });
  } else {
    // default status check
    const param = lower.includes('temperature') ? 'temperature' : lower.includes('vibration') ? 'vibration' : 'all';
    intents.push({ intent: 'GET_MACHINE_STATUS', confidence: 0.7, machine: machineStr, parameter: param });
  }

  return { intents };
}

const uiMapCache = new Map<string, any>();

export function resolveData(intentOutput: IntentOutput, machines: Machine[]) {
  const key = JSON.stringify(intentOutput);
  if (uiMapCache.has(key)) return uiMapCache.get(key);

  const primaryIntent = intentOutput.intents[0];
  let resolvedData: any = null;

  if (primaryIntent.intent === 'COMPARE') {
    // Return top 2 machines
    resolvedData = machines.slice(0, 2);
  } else if (primaryIntent.machine) {
    // Fuzzy matching for simple mock
    resolvedData = machines.find(m => m.name.toLowerCase().includes(primaryIntent.machine!.toLowerCase()));
  }

  // if invalid, will be null
  uiMapCache.set(key, resolvedData);
  return resolvedData;
}

export function mapIntentToUI(intentOutput: IntentOutput, data: any): string[] {
  let panels = new Set<string>();

  if (!data && intentOutput.intents.every(i => i.intent !== 'ANOMALY_CHECK' && i.intent !== 'COMPARE')) {
    return ['ERROR_PANEL'];
  }

  intentOutput.intents.forEach(intent => {
    switch (intent.intent) {
      case 'GET_MACHINE_STATUS':
        panels.add('STATUS_PANEL');
        if (intent.parameter === 'temperature' || intent.parameter === 'vibration') {
          panels.add('TREND_GRAPH');
        }
        break;
      case 'PREDICTION':
        panels.add('STATUS_PANEL');
        panels.add('PREDICTION_PANEL');
        break;
      case 'ANOMALY_CHECK':
        panels.add('SYSTEM_OVERVIEW');
        panels.add('ALERT_PANEL');
        break;
      case 'COMPARE':
        panels.add('COMPARE_VIEW');
        break;
    }
  });

  const priorityMap: Record<string, number> = {
    'ERROR_PANEL': 4,
    'ALERT_PANEL': 3,
    'PREDICTION_PANEL': 2,
    'COMPARE_VIEW': 2,
    'STATUS_PANEL': 1,
    'TREND_GRAPH': 1,
    'SYSTEM_OVERVIEW': 0
  };

  return Array.from(panels).sort((a, b) => (priorityMap[b] || 0) - (priorityMap[a] || 0));
}

export function simulateLiveData(data: any | any[]) {
  if (!data) return;
  const mutate = (m: Machine) => {
    // Slightly jitter temperature & vibration on the latest sensor reading
    if (m.sensorHistory && m.sensorHistory.length > 0) {
      const latest = m.sensorHistory[m.sensorHistory.length - 1];
      latest.temperature += (Math.random() - 0.5) * 2;
      latest.vibration += (Math.random() - 0.5) * 0.5;
    }
  };

  if (Array.isArray(data)) {
    data.forEach(mutate);
  } else {
    mutate(data);
  }
}
