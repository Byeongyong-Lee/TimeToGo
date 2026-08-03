import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { getCityCodes } from '@/api/tagoBusApi';
import SelectField from '@/components/SelectField';
import { useAsync } from '@/hooks/useAsync';
import {
  selectCityCode,
  selectCityName,
  useSettingsStore,
} from '@/store/settingsStore';
import { colors, spacing, typography } from '@/theme';
import type { City, CityCode } from '@/types/bus';
import { isSeoul, SEOUL_CITY } from '@/types/bus';

type Props = {
  label?: string;
  style?: ViewStyle;
};

/**
 * 정류장을 검색할 지역을 고르는 셀렉트.
 *
 * TAGO 도시목록은 140여 건이라 모달에 검색창을 띄웁니다. 목록은 앱 실행당 한 번만
 * 받고(getCityCodes 내부 캐시), 받아오기 전이나 실패했을 때도 저장된 지역
 * 이름은 그대로 보이므로 화면이 비지 않습니다.
 */
export default function CitySelect({ label = '지역', style }: Props) {
  const cityCode = useSettingsStore(selectCityCode);
  const cityName = useSettingsStore(selectCityName);
  const setCity = useSettingsStore(state => state.setCity);

  const { data, error } = useAsync<City[]>(() => getCityCodes(), []);

  // 목록을 못 받았으면 현재 지역 하나만 있는 목록으로 대체합니다.
  // 서울은 TAGO 목록에 없어서 맨 앞에 직접 넣습니다. (@/types/bus 의 SEOUL_CITY)
  const cities = useMemo<City[]>(() => {
    const base =
      data && data.length > 0 ? data : [{ code: cityCode, name: cityName }];
    return base.some(city => isSeoul(city.code))
      ? base
      : [SEOUL_CITY, ...base];
  }, [data, cityCode, cityName]);

  const options = useMemo(
    () => cities.map(city => ({ label: city.name, value: city.code })),
    [cities],
  );

  const handleChange = (code: CityCode) => {
    const city = cities.find(item => item.code === code);
    if (city) {
      setCity(city);
    }
  };

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <SelectField
        label="지역 선택"
        value={cityCode}
        options={options}
        onChange={handleChange}
        searchable
        searchPlaceholder="지역 이름 (예: 대전, 수원)"
      />
      {error ? (
        <Text style={styles.error}>
          지역 목록을 불러오지 못해 현재 지역만 선택할 수 있습니다.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
