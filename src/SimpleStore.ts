import { AbstractKeyValueStore } from "@iepaas/abstract-key-value-store"

export class SimpleStore implements AbstractKeyValueStore {
	_store: any = {}

	async get(key: string): Promise<string | null> {
		return this._store[key] || null
	}

	async getAll(): Promise<Array<{ key: string; value: string }>> {
		return Object.keys(this._store).map(k => ({
			key: k,
			value: this._store[k]
		}))
	}

	async set(key: string, value: string): Promise<void> {
		this._store[key] = value
	}

	async delete(key: string): Promise<void> {
		delete this._store[key]
	}
}
