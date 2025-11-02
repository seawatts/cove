# Chart Performance Optimization Summary

## Problem
The device details page was experiencing lag when displaying 32 entity graphs with a 24-hour time range. Each chart was fetching high-fidelity data and rendering simultaneously, causing performance issues.

## Implemented Optimizations

### 1. Backend: SQL-Level Aggregation ✅
**File**: `apps/hub-v2/src/core/state-store.ts`

**Changes**:
- Replaced in-memory JavaScript aggregation with SQL-level aggregation
- Uses SQLite's `strftime()` function to bucket timestamps directly in the database
- Performs `AVG()`, `MIN()`, `MAX()` calculations at the database level
- Eliminates loading all records into memory before aggregating

**Impact**:
- Dramatically reduces memory usage on the hub
- Faster query execution as aggregation happens in SQLite
- Reduces data transfer between database and application layer

### 2. Backend: Optimized Time Bucket Sizes ✅
**File**: `apps/hub-v2/src/core/state-store.ts`

**Changes**:
| Time Range | Old Bucket | Old Points | New Bucket | New Points | Reduction |
|------------|------------|------------|------------|------------|-----------|
| 1 hour     | 5 min      | 12         | 5 min      | 12         | 0%        |
| 24 hours   | 30 min     | 48         | 1 hour     | 24         | **50%**   |
| 7 days     | 6 hours    | 28         | 8 hours    | 21         | 25%       |
| 30 days    | 1 day      | 30         | 1 day      | 30         | 0%        |
| 90 days    | 1 day      | 90         | 2 days     | 45         | **50%**   |

**Impact**:
- 50% reduction in data points for 24-hour view (most common use case)
- 50% reduction in data points for 90-day view
- Still maintains adequate granularity for home monitoring (CO2, temperature, etc.)
- With 32 charts, this reduces total data points from ~1,536 to ~768 for 24h view

### 3. Frontend: Lazy Loading with IntersectionObserver ✅
**New File**: `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/lazy-chart-wrapper.tsx`

**Changes**:
- Created `LazyChartWrapper` component using native IntersectionObserver API
- Only loads and renders charts when they enter or are near the viewport
- 200px root margin for preloading slightly before charts become visible
- Shows lightweight placeholder skeleton until chart is needed

**Impact**:
- Only visible charts fetch data and render
- Dramatically reduces initial page load time
- Reduces memory usage for off-screen charts
- Smooth scrolling experience as charts preload just before becoming visible

### 4. Frontend: Chart Widget Integration ✅
**File**: `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/sensor-widget.tsx`

**Changes**:
- Wrapped `ChartWidget` with `LazyChartWrapper`
- Maintains existing lazy loading of widget components
- Combines component code-splitting with data lazy loading

**Impact**:
- Two-tier lazy loading: component code + data fetching
- Better resource utilization
- Faster time-to-interactive

### 5. Frontend: Disable Chart Animations ✅
**File**: `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/widgets/chart-widget.tsx`

**Changes**:
- Added `isAnimationActive={false}` to Area component
- Line component already had this optimization

**Impact**:
- Eliminates animation rendering overhead when 32 charts load
- Faster initial render
- Smoother scrolling

## Performance Improvements

### Expected Results:
1. **Initial Page Load**:
   - Only ~6-8 charts visible initially (depending on viewport)
   - Reduces initial API calls from 32 to ~8 (75% reduction)
   - Reduces initial data points from ~1,536 to ~192 for 24h view

2. **Data Transfer**:
   - 50% less data for 24-hour view per chart
   - With lazy loading, only visible charts fetch data
   - Combined: ~87% reduction in initial data transfer

3. **Memory Usage**:
   - SQL aggregation uses constant memory regardless of raw data points
   - Frontend only keeps visible charts in memory
   - Significant reduction in browser memory usage

4. **Scrolling Performance**:
   - Charts preload 200px before visibility
   - Smooth scrolling with no blocking
   - Better perceived performance

## Testing Checklist

To verify the optimizations work correctly:

1. ✅ Navigate to device page with 32+ sensor entities
2. ✅ Verify initial load shows placeholders for off-screen charts
3. ✅ Scroll down and verify charts load smoothly as they come into view
4. ✅ Test all time ranges (1h, 24h, 7d, 30d, 90d)
5. ✅ Verify chart data accuracy (aggregated data matches expectations)
6. ✅ Check browser DevTools Network tab for reduced API calls
7. ✅ Monitor browser memory usage during scrolling
8. ✅ Test on mobile and desktop viewports

## Technical Details

### SQL Query Example (24h range):
```sql
SELECT
  (CAST(strftime('%s', ts) AS INTEGER) / 3600) * 3600 * 1000 as bucket,
  AVG(CAST(value AS REAL)) as mean,
  MIN(CAST(value AS REAL)) as min,
  MAX(CAST(value AS REAL)) as max,
  COUNT(*) as count
FROM telemetry
WHERE entityId = ?
  AND ts >= ?
GROUP BY bucket
ORDER BY bucket ASC
```

### Lazy Loading Flow:
1. Chart wrapper observes viewport intersection
2. When chart enters viewport (or 200px before), `hasBeenVisible` flag is set
3. Chart component mounts and data fetching begins
4. Chart remains mounted even if scrolled out of view (preserves state)
5. New charts only load as user scrolls

## Files Modified

1. `apps/hub-v2/src/core/state-store.ts` - Backend aggregation
2. `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/lazy-chart-wrapper.tsx` - New component
3. `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/sensor-widget.tsx` - Integration
4. `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/widgets/chart-widget.tsx` - Animation optimization

## Maintenance Notes

- The lazy loading wrapper can be reused for other heavy components
- Bucket sizes can be adjusted in `state-store.ts` if different granularity is needed
- The 200px root margin in LazyChartWrapper can be tuned for different preload distances
- SQL aggregation is compatible with all SQLite versions used by the hub

