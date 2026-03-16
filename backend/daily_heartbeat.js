const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const cleanEnv = (value) => String(value || '').trim().replace(/^['\"]|['\"]$/g, '');
const supabaseUrl = cleanEnv(process.env.SUPABASE_URL);
const supabaseKey = cleanEnv(
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isValidSupabaseUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' && /\.supabase\.co$/i.test(parsed.hostname);
    } catch {
        return false;
    }
};

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY).'
    );
}

if (!isValidSupabaseUrl(supabaseUrl)) {
    throw new Error(`Invalid SUPABASE_URL: ${supabaseUrl}`);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const serviceName = cleanEnv(process.env.HEARTBEAT_SERVICE_NAME) || 'worshipcast-backend';
const status = cleanEnv(process.env.HEARTBEAT_STATUS) || 'ok';
const runTimeUtc = cleanEnv(process.env.HEARTBEAT_RUN_UTC) || '00:05';

const getHeartbeatDateUtc = () => new Date().toISOString().slice(0, 10);

const parseUtcRunTime = (value) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return { hour: 0, minute: 5 };

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return { hour: 0, minute: 5 };
    }

    return { hour, minute };
};

const runHeartbeat = async (reason) => {
    const heartbeatDate = getHeartbeatDateUtc();

    const payload = {
        service_name: serviceName,
        heartbeat_date: heartbeatDate,
        status,
        details: {
            reason,
            source: 'daily_heartbeat.js',
            logged_at_utc: new Date().toISOString(),
            node_version: process.version
        }
    };

    const { error } = await supabase
        .from('heartbeat_logs')
        .upsert(payload, { onConflict: 'service_name,heartbeat_date' });

    if (error) {
        throw error;
    }

    console.log(`[heartbeat] logged ${serviceName} on ${heartbeatDate} (reason: ${reason})`);
};

const getMsUntilNextRunUtc = () => {
    const now = new Date();
    const { hour, minute } = parseUtcRunTime(runTimeUtc);

    const nextRun = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hour,
        minute,
        0,
        0
    ));

    if (nextRun.getTime() <= now.getTime()) {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    return nextRun.getTime() - now.getTime();
};

const startDailyScheduler = async () => {
    try {
        await runHeartbeat('startup');
    } catch (err) {
        console.error('[heartbeat] startup log failed:', err.message || err);
    }

    const firstDelayMs = getMsUntilNextRunUtc();
    console.log(`[heartbeat] next scheduled run in ${Math.round(firstDelayMs / 1000)} seconds (UTC ${runTimeUtc})`);

    setTimeout(() => {
        runHeartbeat('scheduled').catch((err) => {
            console.error('[heartbeat] scheduled log failed:', err.message || err);
        });

        setInterval(() => {
            runHeartbeat('scheduled').catch((err) => {
                console.error('[heartbeat] scheduled log failed:', err.message || err);
            });
        }, 24 * 60 * 60 * 1000);
    }, firstDelayMs);
};

module.exports = {
    runHeartbeat,
    startDailyScheduler
};

if (require.main === module) {
    const runOnce = process.argv.includes('--once');

    if (runOnce) {
        runHeartbeat('manual')
            .then(() => process.exit(0))
            .catch((err) => {
                console.error('[heartbeat] one-time log failed:', err.message || err);
                process.exit(1);
            });
    } else {
        startDailyScheduler().catch((err) => {
            console.error('[heartbeat] scheduler failed to start:', err.message || err);
            process.exit(1);
        });
    }
}
