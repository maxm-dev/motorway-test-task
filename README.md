# motorway-test-task

### Key points of solution:
- Used redis for both: caching results of calls to external API and handling inflight requests (to not recall external API if there is inflight request for the same parameter).
- Used redis pub/sub feature to allow communication between inctances of application.
- Code was run and validated that everything works as expected. I've used docker version of redis to check the solution.

### Key steps of `getPrice` alghorithm:
1. Check the flag `skipCacheForRead`:
    - If value is `true` then go to step 4.
2. Check if request with the same `numberPlate` is inflight (inflight requests stored as SET in redis DB).
    - If request is currently inflight then subscribe on redis channel (`numberPlate` is used as channel name) and wait for notification. When notification is recieved return result. END.
3. Check if there is value for `numberPlate` in redis cache.
    - If there is cached value then return it. END.
4. Request external API.
5. Set requests as inflight.
6. Save result in prices cache.
7. Remove request from inflight set.
8. Publish an event with result, use `numberPlate` as channel name.
9. Return result got from external API. END.

### Potential improvements
- Add error handling
- ~~Add unit tests~~ (Done)
- Handle case when there is no notification from other instances when request is marked as inflight. As a possible solution it's possible to add timeout and fallback to call external API.
- Move redis connection string to `.env` file.
- Create redis client abstraction to encapsulate working with database in separate layer.
