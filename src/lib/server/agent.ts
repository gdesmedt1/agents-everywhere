import { Agent, tool, run, setDefaultOpenAIKey } from '@openai/agents';
import { z } from 'zod';

export type AgentRunResult = {
	text: string;
	drafts: Array<{
		kind: 'calendar' | 'todo' | 'note';
		title: string;
		payload: Record<string, unknown>;
	}>;
};

/**
 * Shared agent brain for web + Telegram.
 * Tools return structured drafts; approval / Google write happens in the app layer.
 */
export async function runEverywhereAgent(input: {
	message: string;
	openaiApiKey: string;
	userLabel?: string;
}): Promise<AgentRunResult> {
	const drafts: AgentRunResult['drafts'] = [];

	const proposeCalendarEvent = tool({
		name: 'propose_calendar_event',
		description: 'Propose a calendar event draft for the user to approve.',
		parameters: z.object({
			title: z.string(),
			startsAt: z.string().describe('ISO-8601 start time if known, else best guess'),
			endsAt: z.string().optional(),
			location: z.string().optional(),
			notes: z.string().optional()
		}),
		execute: async (args) => {
			drafts.push({ kind: 'calendar', title: args.title, payload: args });
			return { ok: true, status: 'drafted' };
		}
	});

	const proposeTodo = tool({
		name: 'propose_todo',
		description: 'Propose a todo item draft for the user to approve.',
		parameters: z.object({
			title: z.string(),
			dueAt: z.string().optional(),
			notes: z.string().optional()
		}),
		execute: async (args) => {
			drafts.push({ kind: 'todo', title: args.title, payload: args });
			return { ok: true, status: 'drafted' };
		}
	});

	const agent = new Agent({
		name: 'AgentsEverywhere',
		instructions: [
			'You help busy parents and households turn messy forwards into clear actions.',
			'Extract calendar events and todos. Prefer proposing tools over long essays.',
			'Never claim you already booked something; you only propose drafts.',
			'If dates are ambiguous, still propose with your best guess and say so.',
			input.userLabel ? `User: ${input.userLabel}` : ''
		]
			.filter(Boolean)
			.join('\n'),
		tools: [proposeCalendarEvent, proposeTodo],
		model: 'gpt-4.1-mini'
	});

	setDefaultOpenAIKey(input.openaiApiKey);
	const result = await run(agent, input.message);
	const text =
		typeof result.finalOutput === 'string'
			? result.finalOutput
			: result.finalOutput != null
				? JSON.stringify(result.finalOutput)
				: 'Done. Review the drafts below.';
	return { text, drafts };
}
