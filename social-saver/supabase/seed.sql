-- ============================================
-- DEMO SEED DATA — run after schema.sql
-- ============================================
-- Replace the phone number with your Twilio sandbox phone
INSERT INTO saves (
        user_phone,
        url,
        source,
        title,
        category,
        tags,
        summary,
        status
    )
VALUES (
        'whatsapp:+1234567890',
        'https://www.instagram.com/reel/C1abc123/',
        'instagram',
        'Core workout routine',
        'Fitness',
        ARRAY ['core', 'abs', 'workout', 'home'],
        'A quick 5-minute standing ab workout you can do without any equipment.',
        'complete'
    ),
    (
        'whatsapp:+1234567890',
        'https://www.instagram.com/p/C2def456/',
        'instagram',
        'One-pot pasta recipe',
        'Food',
        ARRAY ['pasta', 'recipe', 'quick', 'dinner'],
        'Creamy garlic tuscan pasta made in one pot in under 20 minutes.',
        'complete'
    ),
    (
        'whatsapp:+1234567890',
        'https://www.instagram.com/reel/C3ghi789/',
        'instagram',
        'React Hooks tips',
        'Coding',
        ARRAY ['react', 'hooks', 'javascript', 'frontend'],
        'Three useEffect patterns most React developers get wrong.',
        'complete'
    ),
    (
        'whatsapp:+1234567890',
        'https://www.instagram.com/reel/C4jkl012/',
        'instagram',
        NULL,
        'Travel',
        ARRAY ['bali', 'travel', 'beach', 'sunset'],
        'Hidden beach in Bali with crystal clear water and no crowds.',
        'complete'
    ),
    (
        'whatsapp:+1234567890',
        'https://www.instagram.com/p/C5mno345/',
        'instagram',
        'UI design trends 2026',
        'Design',
        ARRAY ['ui', 'design', 'trends', 'minimal'],
        'Top 5 UI design trends dominating 2026 — bento grids are everywhere.',
        'complete'
    ),
    (
        'whatsapp:+1234567890',
        'https://www.instagram.com/reel/C6pqr678/',
        'instagram',
        'Morning routine habits',
        'Self-Improvement',
        ARRAY ['morning', 'habits', 'productivity', 'routine'],
        'A neuroscientist-backed morning routine for peak focus and energy.',
        'complete'
    ),
    (
        'whatsapp:+1234567890',
        'https://x.com/elonmusk/status/12345',
        'x',
        'Startup advice thread',
        'Business',
        ARRAY ['startup', 'advice', 'growth', 'funding'],
        'Thread on the most common fundraising mistakes first-time founders make.',
        'complete'
    ),
    (
        'whatsapp:+1234567890',
        'https://www.instagram.com/reel/C7stu901/',
        'instagram',
        NULL,
        'Other',
        ARRAY ['meme', 'funny', 'relatable'],
        'Saved link (add a note to improve).',
        'pending_note'
    ),
    (
        'whatsapp:+1234567890',
        'https://www.instagram.com/reel/C8vwx234/',
        'instagram',
        'Resistance band back workout',
        'Fitness',
        ARRAY ['back', 'resistance', 'bands', 'strength'],
        'Full back workout using only resistance bands — great for travel.',
        'complete'
    ) ON CONFLICT (user_phone, url_hash) DO NOTHING;