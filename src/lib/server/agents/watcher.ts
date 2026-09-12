import { Agent, callable } from 'agents';

export type RegisteredAssumption = {
	decisionId: string;
	decisionStatement: string;
	assumptionId: string;
	statement: string;
};

export type WatcherState = {
	assumptions: RegisteredAssumption[];
};

export class WatcherAgent extends Agent<Env, WatcherState> {
	initialState: WatcherState = { assumptions: [] };

	@callable()
	registerAssumption(input: RegisteredAssumption) {
		const rest = this.state.assumptions.filter((a) => a.assumptionId !== input.assumptionId);
		this.setState({ assumptions: [...rest, input] });
	}
}
