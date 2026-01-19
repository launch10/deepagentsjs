# Template Pool: Pre-cached node_modules for RuntimeValidation

## Problem

RuntimeValidation runs `pnpm install` for every website validation, even though 95%+ of websites use the identical `package.json` from the default template. This takes 30+ seconds per validation when it could be near-instant.

## Solution

Maintain a pool of pre-installed template directories. When validating a website:

1. Check if the user's package.json matches the template (hash comparison)
2. If yes → grab a slot from the pool (fast path, ~1 second)
3. If no → fall back to fresh temp dir + pnpm install (slow path)

## Architecture

```
/tmp/launch10-template-pool/
├── golden/                    # Source of truth, never used directly
│   ├── package.json
│   ├── node_modules/
│   └── ... (template files)
│
├── slots/
│   ├── slot-0/               # Ready to use
│   │   ├── package.json
│   │   ├── node_modules/
│   │   └── src/              # Empty, user files go here
│   ├── slot-1/               # In use
│   └── slot-2/               # Ready to use
│
└── pool.json                  # Pool state metadata
```

## Components

### 1. TemplatePool class

```typescript
interface PoolSlot {
  id: number;
  path: string;
  status: "available" | "in-use" | "dirty";
  lastUsed: Date;
}

class TemplatePool {
  private slots: PoolSlot[];
  private goldenPath: string;
  private templateHash: string; // Hash of template package.json

  // Initialize pool on startup
  async initialize(poolSize: number = 3): Promise<void>;

  // Acquire a slot for validation
  async acquire(): Promise<PoolSlot | null>;

  // Release slot back to pool (or mark dirty)
  async release(slot: PoolSlot, dirty: boolean = false): Promise<void>;

  // Background: replenish dirty/missing slots
  async replenish(): Promise<void>;

  // Check if user's package.json matches template
  matchesTemplate(userPackageJson: string): boolean;
}
```

### 2. Updated WebsiteRunner

```typescript
class WebsiteRunner {
  private usePoolSlot: boolean = false;
  private poolSlot?: PoolSlot;

  // New: Try pool first, fall back to fresh install
  async install(): Promise<void> {
    const pool = TemplatePool.getInstance();
    const userPackageJson = await this.readPackageJson();

    if (pool.matchesTemplate(userPackageJson)) {
      const slot = await pool.acquire();
      if (slot) {
        this.poolSlot = slot;
        this.projectDir = slot.path;
        this.usePoolSlot = true;
        // No install needed - node_modules already there
        return;
      }
    }

    // Fall back to fresh install
    await this.freshInstall();
  }

  async stop(): Promise<void> {
    // ... existing stop logic ...

    // Release pool slot if we used one
    if (this.poolSlot) {
      await this.cleanupUserFiles();
      await TemplatePool.getInstance().release(this.poolSlot);
    }
  }
}
```

### 3. Pool Initialization (startup)

```typescript
// In server startup or worker initialization
async function initializeTemplatePool() {
  const pool = TemplatePool.getInstance();

  // Create golden template with installed deps
  await pool.initialize(3); // 3 slots

  // Start background replenishment
  pool.startReplenishmentLoop();
}
```

## Flow Diagrams

### Fast Path (95% of cases)

```
1. FileExporter exports user files to temp location
2. WebsiteRunner.install() called
3. Check: package.json hash matches template? YES
4. Acquire pool slot (slot-0)
5. Copy user's src/ files into slot-0/src/
6. Run pnpm dev (instant - deps already installed)
7. Run Playwright validation
8. Clean up: remove user's src/ files
9. Release slot-0 back to pool
```

### Slow Path (custom deps)

```
1. FileExporter exports user files to temp location
2. WebsiteRunner.install() called
3. Check: package.json hash matches template? NO
4. Pool returns null
5. Run pnpm install (30+ seconds)
6. Run pnpm dev
7. Run Playwright validation
8. Delete entire temp directory
```

### Dirty Slot Recovery

```
1. Slot released with dirty=true
2. Slot marked as 'dirty' in pool state
3. Background worker detects dirty slot
4. Worker deletes slot directory
5. Worker creates fresh slot from golden template
6. Slot marked as 'available'
```

## Implementation Steps

### Phase 1: Core Pool Implementation

- [ ] Create `TemplatePool` class with initialize/acquire/release
- [ ] Create golden template directory with pre-installed node_modules
- [ ] Add hash comparison for package.json matching
- [ ] Add slot management (available/in-use/dirty states)

### Phase 2: Integration

- [ ] Update `WebsiteRunner.install()` to try pool first
- [ ] Update `WebsiteRunner.stop()` to release slots
- [ ] Add user file cleanup logic (remove src/ files, keep node_modules)
- [ ] Handle edge case: pool exhausted (all slots in use)

### Phase 3: Background Replenishment

- [ ] Add background loop to replenish dirty slots
- [ ] Add pool initialization on server startup
- [ ] Add graceful shutdown (wait for in-use slots)

### Phase 4: Monitoring & Polish

- [ ] Add metrics: pool hit rate, slot wait time, replenishment time
- [ ] Add pool size configuration
- [ ] Add logging for debugging
- [ ] Handle edge case: golden template needs updating (new deps added)

## Edge Cases

1. **Pool exhausted**: All slots in use → fall back to slow path
2. **Slot corruption**: pnpm dev modifies node_modules → mark dirty, replenish
3. **Template update**: package.json changes → invalidate all slots, rebuild golden
4. **Concurrent access**: Use file locks or atomic state updates
5. **Server restart**: Pool state lost → reinitialize on startup
6. **Disk space**: Monitor pool disk usage, limit slot count

## Configuration

```typescript
interface PoolConfig {
  poolSize: number; // Default: 3
  poolDir: string; // Default: /tmp/launch10-template-pool
  replenishInterval: number; // Default: 5000ms
  slotTimeout: number; // Max time a slot can be in-use: 5 minutes
}
```

## Expected Performance

| Scenario            | Before | After               |
| ------------------- | ------ | ------------------- |
| Standard validation | 35-45s | 5-10s               |
| Custom deps (rare)  | 35-45s | 35-45s (unchanged)  |
| Pool exhausted      | N/A    | 35-45s (falls back) |

## Open Questions

1. Should we pre-warm the pool with more slots during low-traffic periods?
2. Should dirty slots be cleaned up immediately or batched?
3. Do we need to handle the case where a user's code modifies node_modules at runtime?
