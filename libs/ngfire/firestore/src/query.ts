import type { Target, OrderBy, FieldFilter } from '@firebase/firestore/dist/firestore/src/core/target';
import type { Value, ArrayValue, MapValue, Timestamp, LatLng } from '@firebase/firestore/dist/firestore/src/protos/firestore_proto_api';
import type { Query } from 'firebase/firestore';
import { exist } from 'ngfire/core';


// Simplfied version of 
// https://github.com/firebase/firebase-js-sdk/blob/master/packages/firestore/src/core/query.ts#L442
export function stringifyQuery(query: Query) {
  if ('_query' in query) {
    const target = (query as any)['_query'] as Target & { limitType: string };
    return `${stringifyTarget(target)}|lt:${target.limitType})`;
  }
  return '';
}

function stringifyTarget(target: Target): string {
  if (!target.orderBy) (target as any).orderBy = [];
  let str = target.path.canonicalString();
  if (target.collectionGroup !== null) {
    str += '|cg:' + target.collectionGroup;
  }
  if (target.filters.length > 0) {
    const fields = target.filters
    .map(f => stringifyFilter(f as FieldFilter))
    .join(', ');
    str += `|f:[${fields}]`;
  }
  if (exist(target.limit)) {
    str += '|l:' + target.limit;
  }
  if (target.orderBy.length > 0) {
    const order = target.orderBy
    .map(o => stringifyOrderBy(o))
    .join(', ');
    str += `|ob:[${order}]`;
  }
  if (target.startAt) {
    str += '|lb:';
    str += target.startAt.inclusive ? 'b:' : 'a:';
    str += target.startAt.position.map(p => canonifyValue(p)).join(',');
  }
  if (target.endAt) {
    str += '|ub:';
    str += target.endAt.inclusive ? 'a:' : 'b:';
    str += target.endAt.position.map(p => canonifyValue(p)).join(',');
  }
  return str;
}

/** Returns a debug description for `filter`. */
export function stringifyFilter(filter: FieldFilter): string {
  return `${filter.field.canonicalString()} ${filter.op} ${canonifyValue(filter.value)}`;
}

export function stringifyOrderBy(orderBy: OrderBy): string {
  return `${orderBy.field.canonicalString()} (${orderBy.dir})`;
}

/* eslint-disable */
function canonifyValue(value: Value): string {
  if ('nullValue' in value) {
    return 'null';
  } else if ('booleanValue' in value) {
    return '' + value.booleanValue;
  } else if ('integerValue' in value) {
    return '' + value.integerValue;
  } else if ('doubleValue' in value) {
    return '' + value.doubleValue;
  } else if ('timestampValue' in value) {
    return canonifyTimestamp(value.timestampValue!);
  } else if ('stringValue' in value) {
    return value.stringValue!;
  } else if ('bytesValue' in value) {
    return canonifyByteString(value.bytesValue!);
  } else if ('referenceValue' in value) {
    return value.referenceValue!;
  } else if ('geoPointValue' in value) {
    return canonifyGeoPoint(value.geoPointValue!);
  } else if ('arrayValue' in value) {
    return canonifyArray(value.arrayValue!);
  } else if ('mapValue' in value) {
    return canonifyMap(value.mapValue!);
  } else {
    throw new Error('Invalid value type: ' + JSON.stringify(value));
  }
}
/* eslint-enable */


function canonifyByteString(byteString: string | Uint8Array): string {
  if (typeof byteString === 'string') return byteString;
  return byteString.toString();
}



function canonifyTimestamp(timestamp: Timestamp): string {
  return `time(${timestamp.toString()})`;
}

function canonifyGeoPoint(geoPoint: LatLng): string {
  return `geo(${geoPoint.latitude},${geoPoint.longitude})`;
}

function canonifyMap(mapValue: MapValue): string {
  // Iteration order in JavaScript is not guaranteed. To ensure that we generate
  // matching canonical IDs for identical maps, we need to sort the keys.
  const sortedKeys = Object.keys(mapValue.fields || {}).sort();
  // eslint-disable-next-line
  const content = sortedKeys.map(key => `${key}:${canonifyValue(mapValue.fields![key])}`).join(',');
  return `{${content}}`;
}

function canonifyArray(arrayValue: ArrayValue): string {
  const values = arrayValue.values || [];
  return `[${values.map(canonifyValue).join(',')}]`;
}
