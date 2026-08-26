# IVAO Radar Navigational Data

IVAO Radar gets it's data from 3 sources:
- VATSpy (airports and FIR/ARTCC boundaries in non-VG mode): https://github.com/vatsimnetwork/vatspy-data-project
- SimAware TRACON (approach in non-VG mode): https://github.com/vatsimnetwork/simaware-tracon-project
- VATGlasses: https://github.com/lennycolton/vatglasses-data

Visit those sources to apply requested changes.

IVAO Radar applies changes:
- From VATSpy and SimAware TRACON: within a few hours since Github Release publish
- From VG: within a few hours from merged commit

## ATC controlling multiple sectors

By default, ATC can only control a primary sector. In IVAO Radar, we allow controllers from selected regions to duplicate themselves using specific rules and datasets. You can read more about it [here](../guide/duplicating).
