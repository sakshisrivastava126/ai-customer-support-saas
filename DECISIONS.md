# Decisions

- **Gemini models:** gemini-2.5-flash for answers and gemini-embedding-001 for embeddings. Stable releases; model names are env variables so they can be swapped.
- **In-process ingestion queue:** no Redis or worker service, to keep deployment simple. Stuck jobs are marked failed on restart.
- **Health check:** uses the Mongoose connection state, not a database ping. The handler stays inline in the routes file as the one exception to the controller rule.
- **trust proxy = 1:** Render sits behind one proxy, so this lets rate limiting see the real client IP.
- **Error mapping:** a malformed ObjectId returns 400; an oversized JSON body returns 413.
- **Signup transaction:** tenant and admin IDs are created up front so both inserts can reference each other, and a failed user insert rolls back the tenant.
- **Stateless JWT:** requireAuth trusts a valid token without a database read. Deleting a user or changing a role takes effect when the token expires (1 day).
- **Password limits:** 8 to 72 characters and at most 72 UTF-8 bytes, because bcrypt ignores anything past 72 bytes. Login only checks that a password is non-empty.
- **JWT_EXPIRES_IN:** validated at startup. Digit-only values become numbers because jsonwebtoken treats numeric strings as milliseconds.
- **Port 5004:** port 5000 is used by AirPlay Receiver on macOS.
- **Chunk embeddings are checked on save:** Chunk rejects embeddings that aren't exactly EMBEDDING_DIMENSIONS finite numbers, because Atlas vector search silently skips wrong-sized vectors.
- **Optional arrays are omitted, not stored empty:** Message.sources and Chunk.embedding use default: undefined, so a missing embedding fails validation instead of saving as [].
- **One conversation index:** { tenantId, lastMessageAt, unansweredCount } serves both the full list and the "unanswered only" list, sorted by latest message.
- **MongoDB DNS:** some Indian ISPs fail the SRV lookup used by mongodb+srv:// connection strings (querySrv ENOTFOUND). Fixed by setting the Mac's DNS to 8.8.8.8 and 1.1.1.1.
